import {RadioClock} from '../../public/radio-clock.mjs';
import {RadioMedium} from '../../public/nrf24.mjs';
import {createCircuitHost} from '../../public/circuit-host.mjs';
import {createS3Engine} from '../../public/s3-engine.mjs';
import {wasmBytes} from '../../public/s3-contract.mjs';
import {buildFile,validateArtifact} from '../../public/arduino-contract.mjs';
import {AVR_TARGETS} from '../../public/avr-contract.mjs';
import {parseProject,type Project} from '../project/model';
import {prepareRun} from '../runtime/adapter';
import {AVREngine} from '../runtime/avrEngine';
export type RadioNode='A'|'B';
let moduleSerial=0;
const allowed=new Set(['board','nrf24','led','resistor','button','potentiometer','breadboard']);
/** Nodes share one event queue. AVR advances atomic instructions; functional
 * S3 yields on each imported API and MicroPython yields at sleep calls. */
export async function createRadioExperiment(projects:Project[],send:(e:any)=>void,options:{runtimeBase:string;machine:string;harden?:boolean}){
 if(projects.length!==2)throw Error('Radijska mreža zahtijeva točno dva čvora.');
 const clock=new RadioClock(),medium=new RadioMedium(clock),nodes:any[]=[],cpus:any[]=[];
 let stopped=false,error:Error|undefined;
 const emit=(node:RadioNode,e:any)=>{if(!stopped)send({...e,node});};
 try{
  for(let i=0;i<2;i++){
   const id=(i?'B':'A')as RadioNode,p=parseProject(projects[i]),snapshot=prepareRun(p),circuit=snapshot.circuit;
   if(!circuit||p.circuit.kind!=='editable'||p.circuit.components.some(c=>!allowed.has(c.kind))||p.circuit.components.filter(c=>c.kind==='nrf24').length!==1)throw Error('Dva čvora: svaki sklop treba točno jedan NRF24L01+. Ovaj profil dopušta pločicu, breadboard, LED, otpornike, tipkala i potenciometar.');
   const state:any={id,project:p,done:false,text:'',engine:null,host:null,mp:null};nodes.push(state);
   const observe=(e:any)=>emit(id,e);
   if(p.language==='arduino-cpp'){
    const artifact=await validateArtifact(p,JSON.parse(p.files[buildFile(p)]??'null'));
    if(p.runtimeProfile.id==='arduino-avr'){
     state.engine=new AVREngine(artifact.hex,circuit,observe,AVR_TARGETS[p.board.id as keyof typeof AVR_TARGETS].adc,artifact.staticRamBytes,{radioMedium:medium,radioNode:id});
     cpus.push({id,engine:state.engine});emit(id,{type:'ready'});
    }else state.engine=await createS3Engine(wasmBytes(artifact.wasm),circuit,observe,{clock,medium,node:id});
   }else{
    const {loadMicroPython}=await import(/* @vite-ignore */ options.runtimeBase+'runtime/micropython.mjs?radioNode='+id+'-'+(++moduleSerial));
    const decoder=new TextDecoder();
    const stdout=(bytes:Uint8Array)=>{state.text=(state.text+decoder.decode(bytes,{stream:true})).slice(-24000);};
    state.mp=await loadMicroPython({heapsize:4*1024*1024,pystack:16384,linebuffer:false,stdout,stderr:stdout});
    state.host=createCircuitHost(observe,{circuit,nowUs:()=>clock.now,advanceUs:()=>{},manualPublish:true,radioMedium:medium,radioNode:id});
    // MicroPython's normal runtime stays untouched outside this experiment.
    // Positive sleep_us rounds up to milliseconds in this cooperative profile.
    Object.assign(state.host,{delayUs:()=>false,waitMs:()=>{},scheduleSleep:(wake:()=>void,ms:number)=>clock.after(Math.max(1,ms*1000),wake)});
    if(options.harden)(globalThis as any).proxy_js_ref[0]=Object.freeze(Object.create(null));
    state.mp._module.labHost=state.host;state.mp.FS.writeFile('/machine.py',options.machine);
    for(const [path,text]of Object.entries(snapshot.files)){
     const parts=path.split('/');parts.pop();let dir='';for(const part of parts){dir+='/'+part;if(!state.mp.FS.analyzePath(dir).exists)state.mp.FS.mkdir(dir);}state.mp.FS.writeFile('/'+path,text);
    }
    state.mp.FS.writeFile('/main.py',snapshot.source);
   }
  }
  if(options.harden)Date.now=()=>Math.floor(clock.now/1000);
  const fail=(id:RadioNode,e:unknown)=>{if(stopped)return;error=e instanceof Error?e:Error(String(e));const state=nodes.find(n=>n.id===id);if(state?.text){emit(id,{type:'console',text:state.text});error.message+='\n'+state.text.slice(-2000);state.text='';}emit(id,{type:'error',message:error.message});};
  for(const node of nodes){
   if(node.mp){emit(node.id,{type:'ready'});void node.mp.runPython("exec(compile(open('/main.py').read(), 'main.py', 'exec'))").then(()=>{node.done=true;emit(node.id,{type:'done'});},(e:unknown)=>fail(node.id,e));}
   else if(node.project.runtimeProfile.id==='arduino-s3-wasm')void node.engine.run().catch((e:unknown)=>fail(node.id,e));
  }
  // Promise/Asyncify continuations settle before choosing the next event.
  const settle=async()=>{for(let n=0;n<8;n++)await Promise.resolve();};
  await settle();
  return {
   clock,medium,nodes,
   async advanceUntil(target:number,wallBudgetMs=Infinity){
    const wall=performance.now();let steps=0;
    while(!stopped&&!error){
     let cpu:any;for(const c of cpus)if(!cpu||c.engine.cpu.cycles<cpu.engine.cpu.cycles)cpu=c;
     const cpuAt=cpu?cpu.engine.cpu.cycles/16:Infinity,next=Math.min(clock.next,cpuAt);
     if(next>target||next===Infinity){clock.now=Math.max(clock.now,target);break;}
     if(clock.next<=cpuAt){clock.fire();await settle();}
     else{clock.now=Math.max(clock.now,cpuAt);cpu.engine.runCycles(1);}
     if((++steps&511)===0&&performance.now()-wall>=wallBudgetMs)break;
    }
    if(error)throw error;return clock.now;
   },
   frame(){for(const node of nodes){if(node.text){emit(node.id,{type:'console',text:node.text});node.text='';}if(node.host)node.host.flush();else if(node.engine?.frame)node.engine.frame();else node.engine?.snapshot();}send({type:'radio',...medium.snapshot()});},
   input(node:RadioNode,data:Record<string,unknown>){const n=nodes.find(n=>n.id===node);if(n?.host)n.host.input(data);else n?.engine?.input(data);},
   impair(data:Record<string,unknown>){medium.impair(data);},
   stop(){if(stopped)return;stopped=true;clock.stop();for(const node of nodes){node.host?.dispose();node.engine?.stop?.();node.engine?.dispose?.();}},
  };
 }catch(e){clock.stop();for(const node of nodes){node.host?.dispose();node.engine?.stop?.();node.engine?.dispose?.();}throw e;}
}
