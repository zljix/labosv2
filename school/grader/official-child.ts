import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {compileCircuit} from '../../src/circuit/compile';
import {checkCircuit} from '../../src/circuit/netlist';
import {parseProject} from '../../src/project/model';
import {AVREngine} from '../../src/runtime/avrEngine';
import {createHost} from '../../public/host.mjs';

let raw='';for await(const chunk of process.stdin){raw+=chunk;if(Buffer.byteLength(raw)>4194304)throw Error('Prevelika snimka.');}
const {project:input,artifact,profile,seed}=JSON.parse(raw),project=parseProject(input);
const config=compileCircuit(project.circuit as any,project.language==='micropython'?'micropython':'avr');
const kind=profile.kind,led=config.leds[0],button=config.buttons[0],pot=config.pots[0];
const sensor:any=kind==='lm35'?config.analogInputs[0]:config.i2cDevices[0];
let randomState=parseInt(seed.slice(0,8),16)||1;
const random=()=>{randomState^=randomState<<13;randomState^=randomState>>>17;randomState^=randomState<<5;return(randomState>>>0)/4294967296;};
const backend=project.language==='micropython'?'micropython':'avr';
// ADC receives a voltage, never a fabricated ADC return value. S3's 11 dB
// transfer saturates at 3.1 V, whereas the Uno/Nano full scale is 5 V.
const thresholdPosition=backend==='micropython'?3.1/3.3*2048/4095:512/1023;
const stimuli:any[]=kind==='button'?[false,true,false,true,false].map(pressed=>({pressed})):
  kind==='analog'?[0,.12+random()*.2,.7+random()*.2,thresholdPosition-.005,thresholdPosition,1,0].map(position=>({position})):
  kind==='blink'?[{}]:kind==='lm35'?[5+random()*15,40+random()*25,85+random()*25].map(t=>({temperature:Math.round(t*10)/10})):
  [0,1,2].map(()=>({temperature:Math.round((-12+random()*55)*10)/10,pressure:Math.round(85000+random()*18000)}));
if(kind==='lm35')stimuli.push({...stimuli[0]});
const duration=kind==='sensor'?5000:kind==='blink'?4250:kind==='lm35'?1000:250,samples:any[]=[],edges:{timeMs:number;on:boolean}[]=[];
let last:any,consoleText='',programError:string|null=null,stage=0,clockUs=0;
let lineBuffer='';const outputLines:{timeMs:number;text:string}[]=[];
const consoleOutput=(text:string)=>{
  consoleText=(consoleText+text).slice(-32768);lineBuffer=(lineBuffer+text).slice(-32768);
  let end:number;while((end=lineBuffer.indexOf('\n'))>=0){
    outputLines.push({timeMs:backend==='avr'?(last?.timeMs??0):clockUs/1000,text:lineBuffer.slice(0,end)});
    lineBuffer=lineBuffer.slice(end+1);if(outputLines.length>2048)outputLines.shift();
  }
};
const withinInterval=(times:number[],maximum:number)=>{
  const points=[stage*duration,...times,(stage+1)*duration];
  return times.length>0&&points.slice(1).every((time,i)=>time-points[i]<=maximum);
};
const observe=(event:any)=>{
  if(event.type==='simulation'){
    last=event;
    if(kind==='blink'){
      const current=event.leds[led.id]?.currentMa,on=current>.5;
      if((on||current<.05)&&edges.at(-1)?.on!==on&&edges.length<1000)edges.push({timeMs:event.timeMs,on});
    }
  }
  if(event.type==='console')consoleOutput(event.text);
};
const stimulus=(s:any)=>({component:kind==='button'?button.id:kind==='analog'?pot.id:kind==='blink'?led.id:sensor.id,...s,...(kind==='analog'?{position:s.position*100}:{})});
function record(){
  const s=stimuli[stage];let passed=false;
  if(kind==='sensor'){
    const reads=(last?.measurements??[]).filter((m:any)=>m.component===sensor.id&&m.timeMs>stage*duration+250&&Math.abs(m.temperature-s.temperature)<.3&&Math.abs(m.pressure-s.pressure)<150);
    const lines=consoleText.matchAll(/T\s*=\s*(-?\d+(?:\.\d+)?)\s*(?:°?C)?\s+P\s*=\s*(\d+(?:\.\d+)?)/g);
    const freshEnough=!profile.sensorKind||withinInterval(reads.map((r:any)=>r.timeMs),2300);
    passed=reads.length>0&&freshEnough&&[...lines].some(m=>Math.abs(Number(m[1])-s.temperature)<.3&&Math.abs(Number(m[2])-s.pressure)<150);
    samples.push({index:stage+1,...s,passed,newI2cReading:reads.length>0});
  }else if(kind==='lm35'){
    const device=last?.analogInputs?.[sensor.id],net=sensor.outputs.OUT;
    const adc=config.gpios.find(p=>p.net===net&&last?.gpios[p.pin]?.mode==='ADC');
    const validPath=!!device?.powered&&!!adc&&Math.abs(device.volts.OUT-s.temperature*.01)<.003;
    const freshTimes=outputLines.filter(line=>line.timeMs>=stage*duration&&
      [...line.text.matchAll(/\bT\s*=\s*(-?\d+(?:\.\d+)?)/g)].some(m=>Math.abs(Number(m[1])-s.temperature)<=.6)).map(l=>l.timeMs);
    const freshEnough=withinInterval(freshTimes,424);
    passed=validPath&&freshEnough;
    samples.push({index:stage+1,...s,passed,validAdcPath:validPath,freshEnough});
  }else if(kind==='blink'){
    samples.push({index:1,edges});
  }else{
    const expected=kind==='button'?s.pressed:s.position>=thresholdPosition;
    const current=last?.leds[led.id]?.currentMa??null;
    passed=current!==null&&(expected?current>.5:current<.05);
    samples.push({index:stage+1,...s,expected,currentMa:current,passed});
  }
  consoleText='';outputLines.length=0;lineBuffer='';
}
if(project.language==='arduino-cpp'){
  const engine=new AVREngine(artifact.hex,config,observe,project.board.id.includes('nano')?8:6,artifact.staticRamBytes);
  try{for(stage=0;stage<stimuli.length;stage++){
    engine.input(stimulus(stimuli[stage]));
    for(let tick=0;tick<duration/4;tick++){engine.runCycles(64000);engine.frame();}
    record();
  }}catch(e){programError=(e as Error).message.slice(0,500);}finally{engine.dispose();}
}else{
  const publicRoot=process.env.LAB_GRADER_PUBLIC!,{loadMicroPython}=await import(pathToFileURL(publicRoot+'/runtime/micropython.mjs').href);
  const host:any=createHost(observe,{circuit:config,nowUs:()=>clockUs});host.input(stimulus(stimuli[0]));
  let complete!:()=>void;const done=new Promise<void>(ok=>complete=ok);
  host.scheduleSleep=(wake:()=>void,ms:number)=>{
    // Capture GPIO writes at their actual virtual time before advancing sleep.
    if(kind==='blink')host.flush();
    const target=clockUs+Math.max(.05,ms)*1000;
    while(stage<stimuli.length&&target>=(stage+1)*duration*1000){
      clockUs=(stage+1)*duration*1000;host.flush();record();stage++;
      if(stage===stimuli.length){complete();return;}
      host.input(stimulus(stimuli[stage]));
    }
    clockUs=target;host.flush();setImmediate(wake);
  };
  const decoder=new TextDecoder();
  const mp=await loadMicroPython({heapsize:4*1024*1024,pystack:16384,stdout:(text:Uint8Array)=>consoleOutput(decoder.decode(text,{stream:true})),stderr:()=>{},linebuffer:false});
  // The upstream WASM port exposes a `js` proxy rooted at slot zero. Student
  // Python must never reach Node, Module.labHost, the checker or its stimulus.
  (globalThis as any).proxy_js_ref[0]=Object.freeze(Object.create(null));
  mp._module.labHost=host;Date.now=()=>Math.floor(clockUs/1000);
  mp.FS.writeFile('/machine.py',await readFile(publicRoot+'/machine.py','utf8'));
  for(const [name,value]of Object.entries(project.files)){
    if(!/\.(py|txt|json)$/.test(name)||name.split('/').some(p=>['machine.py','_lab.py','project.json'].includes(p.toLowerCase())))continue;
    const parts=name.split('/');parts.pop();let dir='';for(const p of parts){dir+='/'+p;if(!mp.FS.analyzePath(dir).exists)mp.FS.mkdir(dir);}
    mp.FS.writeFile('/'+name,value);
  }
  const running=mp.runPython("exec(compile(open('/main.py').read(), 'main.py', 'exec'))").then(()=>{
    if(stage<stimuli.length){programError='Program je završio prije završetka scenarija.';complete();}
  }).catch(()=>{programError='Program je prijavio pogrešku. Provjeri kod pokretanjem u laboratoriju.';complete();});
  await Promise.race([done,running]);
}
const diagnostics=checkCircuit(project.circuit as any).diagnostics;
const wiring=diagnostics.every(d=>d.severity!=='error'&&!['unconnected','led-open-path','led-polarity','bypassed'].includes(d.code));
const pass=(indices:number[])=>indices.every(i=>samples[i]?.passed===true);
const gpio=(net:number)=>config.gpios.some(p=>p.net===net),ground=(net:number)=>config.referenceGrounds.includes(net),supply=(net:number)=>config.rails.some(r=>r.net===net&&r.volts>0);
const inputPath=kind==='button'?(ground(button.a)&&gpio(button.b))||(ground(button.b)&&gpio(button.a)):
  kind==='analog'?gpio(pot.w)&&((supply(pot.a)&&ground(pot.b))||(supply(pot.b)&&ground(pot.a))):false;
const connection=kind==='sensor'?samples.some(s=>s.newI2cReading):kind==='lm35'?samples.some(s=>s.validAdcPath):
  kind==='blink'?wiring&&edges.some(e=>e.on):wiring&&inputPath&&samples.length>0;
// Startup before the first illuminated interval is not a complete off interval.
const firstOn=edges.findIndex(e=>e.on),activeEdges=edges.slice(firstOn<0?0:firstOn);
const spans=activeEdges.slice(1).map((edge,i)=>({on:activeEdges[i].on,durationMs:edge.timeMs-activeEdges[i].timeMs})).filter(s=>s.durationMs>0);
const repeated=spans.filter(s=>s.on).length>=3&&spans.filter(s=>!s.on).length>=3;
const outcomes=kind==='button'?[connection,pass([0,1,2]),pass([3,4])]:kind==='analog'?[connection,pass([0,1,2]),pass([3,4,5,6])]:
  kind==='blink'?[connection,repeated,repeated&&spans.every(s=>Math.abs(s.durationMs-(s.on?250:750))<=24)]:
  kind==='lm35'?[connection,pass([0,1]),pass([2,3])]:[connection,pass([0,1]),pass([2])];
const criteria=profile.criteria.map((c:any,i:number)=>({...c,passed:!!outcomes[i],points:outcomes[i]?c.maxPoints:0,
  explanation:outcomes[i]?'Zahtjev je potvrđen neovisnim izvođenjem.':'Zahtjev nije potvrđen u svim pripadnim scenarijima.'}));
process.stdout.write(JSON.stringify({status:programError?'program_error':'evaluated',points:criteria.reduce((s:number,c:any)=>s+c.points,0),maxPoints:10,criteria,samples,
  message:programError??'Provjerena je točna spremljena snimka.',virtualDurationMs:duration*stimuli.length,peakRssKiB:process.resourceUsage().maxRSS}));
process.exit(0);
