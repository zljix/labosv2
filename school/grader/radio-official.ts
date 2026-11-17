import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {compileCircuit} from '../../src/circuit/compile';
import {S3,UNO,NANO} from '../../src/boards/profiles';
import {buildFile,inputHash,validateArtifact} from '../../public/arduino-contract.mjs';
import {sandboxCommand,runSandbox} from './sandbox.mjs';
export const isRadioContract=(p:any)=>p.checkerVersion==='24M.1';
const target=(p:any)=>p.board.id===S3?(p.language==='micropython'?'micropython':'s3-cpp'):p.board.id===UNO?'uno':p.board.id===NANO?'nano':null;
export async function gradeRadio(project:any,profile:any,seed:string,base:any,options:any){
  const root=resolve(options.root),started=performance.now();
  const fail=(message:string)=>({...base,status:'program_error',points:0,maxPoints:10,message,criteria:profile.criteria.map((c:any)=>({...c,passed:false,points:0,explanation:message}))});
  if(!project.radio||project.radio.peer.radio)return {...base,status:'unsupported',message:'Radijska provjera zahtijeva točno dva spremljena čvora.'};
  const first=structuredClone(project),peer=first.radio.peer;delete first.radio;first.schemaVersion=3;
  const nodes=[first,peer],provenance:any={nodes:{}};
  try{
    for(const node of nodes){
      const c=compileCircuit(node.circuit,node.runtimeProfile.id==='arduino-avr'?'avr':'micropython');
      if(node.circuit.kind!=='editable'||c.spiDevices.length!==1||c.spiDevices[0].kind!=='nrf24'||c.i2cDevices.length||c.rtcDevices.length)
        return fail('Svaki čvor treba jedan NRF24L01+ i valjan sklop iz objavljenih uputa.');
    }
  }catch{return fail('Pregledaj električne spojeve obaju čvorova.');}
  try{
    for(const [i,node]of nodes.entries()){
      const t=target(node),id=i?'B':'A';if(!profile.targets.includes(t))return {...base,status:'unsupported',message:'Cilj drugog čvora nije podržan.'};
      if(t==='micropython'){provenance.nodes[id]={target:t,method:'source-execution'};continue;}
      let artifact:any,info:any;
      if(options.compile){
        const s3=t==='s3-cpp',command=sandboxCommand(root,resolve(root,s3?'school/grader/s3-compile-child.mjs':'school/grader/compile-child.mjs'),
          {bounded:true,...(s3?{s3Compiler:true,toolchainRoot:options.s3Toolchain}:{compiler:true,cli:options.cli,data:options.data})});
        const compiled:any=await runSandbox(command,s3?{project:node,clang:options.clang??'clang++-19',opt:options.opt??'wasm-opt'}:node,90000);
        if(compiled.status!=='compiled')return compiled.status==='compile_error'?fail('Prevođenje čvora '+id+' nije uspjelo.'):{...base,status:'technical_error',message:'Izolirani prevoditelj čvora '+id+' nije dostupan.'};
        artifact=await validateArtifact(node,compiled.artifact);info={method:'isolated-source-compilation',compilerIdentity:compiled.compilerIdentity};
      }else{
        const catalogue=JSON.parse(await readFile(resolve(root,'public/radio-examples.json'),'utf8')),hash=await inputHash(node);
        const entry:any=Object.values(catalogue[t!]??{}).find((a:any)=>a.inputHash===hash);
        if(!entry)return {...base,status:'unsupported',message:'Promijenjeni C++ izvor čvora '+id+' zahtijeva izolirano prevođenje. Stara binarna datoteka nije pokrenuta.'};
        artifact=await validateArtifact(node,entry);info={method:'trusted-radio-catalogue-exact-source'};
      }
      node.files[buildFile(node)]=JSON.stringify(artifact);
      provenance.nodes[id]={target:t,...info,inputHash:artifact.inputHash,hexHash:artifact.hexHash,wasmHash:artifact.wasmHash,toolchain:artifact.toolchain};
    }
    provenance.method='independent-two-node-execution';
    const report:any=await runSandbox(sandboxCommand(root,resolve(root,'.build/school-grader/radio-child.mjs'),{bounded:true,cpuSeconds:58}),
      {nodes,profile,seed},options.timeoutMs??65000);
    return {...base,...report,provenance,durationMs:Math.round(performance.now()-started)};
  }catch(e){
    const limit=['EXECUTION_LIMIT','OUTPUT_LIMIT','MEMORY_LIMIT'].includes((e as any).code);
    return {...base,status:limit?'execution_limit':'technical_error',message:limit?'Izvođenje para je doseglo dopuštene resurse. Bodovi nisu dodijeljeni.':'Izolirani servis para nije dostupan. Bodovi nisu dodijeljeni.'};
  }
}
