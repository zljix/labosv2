import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {Worker} from 'node:worker_threads';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {stepperCircuit,stepperExamples,type StepperExample} from '../src/circuit/stepperExamples';
import {compileCircuit,type SimulationFrame} from '../src/circuit/compile';
import {parseCircuit,terminals,makePart,type Circuit} from '../src/circuit/model';
import {checkCircuit} from '../src/circuit/netlist';
import {S3,UNO,NANO,type BoardId} from '../src/boards/profiles';
import {arduinoExampleProject} from '../src/runtime/arduinoExamples';
import {newProject,parseProject} from '../src/project/model';
import {exportZip,importProject} from '../src/project/archive';
import {exportSketch} from '../src/project/sketch';
import {validateArtifact} from '../public/avr-contract.mjs';
import {createCircuitHost} from '../public/circuit-host.mjs';
import {AVREngine} from '../src/runtime/avrEngine';
import {Session} from '../dist/session.mjs';
const keys=Object.keys(stepperExamples)as StepperExample[];
const frame=(events:any[])=>events.filter(e=>e.type==='simulation').at(-1) as SimulationFrame;
const text=(events:any[])=>events.filter(e=>e.type==='console').map(e=>e.text).join('');
mkdirSync('docs/stage15-evidence',{recursive:true});
const save=(name:string,v:any)=>writeFileSync('docs/stage15-evidence/'+name+'.json',JSON.stringify(v,null,2)+'\n');
function fixture(board:BoardId=S3,edit=(c:Circuit)=>{}){
 const c=stepperCircuit('stepperBasic',board);edit(c);let now=0;const events:any[]=[];
 const h=createCircuitHost((e:any)=>events.push(e),{circuit:compileCircuit(c,board===S3?'micropython':'avr'),logicVoltage:board===S3?3.3:5,nowUs:()=>now,manualPublish:true});
 const set=(pin:number,value:number)=>h.write(pin,value),time=(us:number)=>{now+=us;};
 for(const [p,v]of [[2,0],[3,1],[4,0],[5,1],[6,1],[7,0],[8,0],[9,0]])h.mode(p,1,0,v);
 time(2000);
 const pulse=(n=1,high=10,low=10)=>{for(let i=0;i<n;i++){set(2,1);time(high);set(2,0);time(low);}};
 const snapshot=()=>{h.flush();return frame(events);};
 const mode=(bits:number)=>{set(7,bits&1);set(8,(bits>>1)&1);set(9,(bits>>2)&1);time(10);};
 return {c,h,set,time,pulse,snapshot,mode,events};
}
const driver=(s:SimulationFrame)=>s.steppers!.drivers.stepperDriver;
const motor=(s:SimulationFrame)=>s.steppers!.motors.stepperMotor;
const factory=()=>{const w=new Worker(new URL('./node-worker.mjs',import.meta.url)),shim:any={postMessage:(d:any)=>w.postMessage(d),terminate:()=>w.terminate()};w.on('message',data=>shim.onmessage?.({data}));w.on('error',error=>shim.onerror?.(error));return shim;};
function python(key:StepperExample,code=stepperExamples[key].code,c=stepperCircuit(key)){return new Session(factory,readFileSync('public/machine.py','utf8'),code,{circuit:compileCircuit(c)});}
function advance(e:AVREngine,ms:number){for(let n=0;n<ms;n+=10){e.runCycles(160000);e.frame();}}

test('three stepper examples across three board profiles round-trip JSON, ZIP, sketch and source-bound artifacts',async()=>{
 const artifacts=JSON.parse(readFileSync('public/avr-examples.json','utf8'));
 for(const board of [S3,UNO,NANO]as const)for(const key of keys){const p=board===S3?newProject(stepperExamples[key].code,stepperExamples[key].title):arduinoExampleProject(key,board);p.circuit=stepperCircuit(key,board);assert.deepEqual(parseCircuit(p.circuit),p.circuit);assert.deepEqual(checkCircuit(p.circuit).diagnostics,[]);assert.deepEqual(importProject(exportZip(p),'a.zip'),parseProject(p));if(board!==S3){await validateArtifact(p,artifacts[board][key]);assert(exportSketch(p).length>0);}}
});
for(const [factor,bits]of [[1,0],[2,1],[4,2],[8,3],[16,7]])test(`1/${factor}: pulse count, sign and 90 degree displacement`,()=>{
 const f=fixture();try{f.mode(bits);f.pulse(50*factor);let s=f.snapshot();assert.equal(driver(s).accepted,50*factor);assert.equal(driver(s).translatorTicks,800);assert.equal(driver(s).resolution,factor);assert.equal(motor(s).angle,90);f.set(3,0);f.time(10);f.pulse(50*factor);s=f.snapshot();assert.equal(motor(s).angle,0);assert.equal(driver(s).rejected,0);if(factor===16)save('microstep-sixteenth',s);}finally{f.h.dispose();}
});
test('400 full steps per revolution gives half the angle for the same STEP train',()=>{
 const f=fixture(S3,c=>{c.components.find(p=>p.kind==='stepperMotor')!.properties.fullSteps=400;});try{f.pulse(50);assert.equal(motor(f.snapshot()).angle,45);}finally{f.h.dispose();}
 for(const invalid of [0,201,200.5,Infinity,10004]){const c=stepperCircuit('stepperBasic');c.components.find(p=>p.kind==='stepperMotor')!.properties.fullSteps=invalid;assert.throws(()=>parseCircuit(c));}
});
test('ENABLE disables coil targets but does not freeze the A4988 translator',()=>{
 const f=fixture();try{f.pulse(10);f.set(4,1);f.pulse(10);let s=f.snapshot();assert.equal(driver(s).translatorTicks,320);assert.equal(driver(s).accepted,20);assert.equal(driver(s).phaseA,null);assert.equal(motor(s).idealAngle,18);assert.equal(motor(s).angle,null);assert(!motor(s).positionCertain);f.set(4,0);s=f.snapshot();assert(driver(s).enabled);assert.equal(motor(s).idealAngle,18);assert.equal(motor(s).angle,null);save('enable-translator',s);}finally{f.h.dispose();}
});
test('RESET selects electrical Home, ignores STEP and does not home the shaft',()=>{
 const f=fixture();try{f.pulse(10);f.set(5,0);f.time(10);f.pulse(3);let s=f.snapshot();assert.equal(driver(s).translatorTicks,0);assert.equal(driver(s).ignored,3);assert(!driver(s).enabled);assert.equal(driver(s).rejected,0);assert.equal(motor(s).idealAngle,18);assert.equal(motor(s).angle,null);f.set(5,1);f.time(10);f.pulse(1);s=f.snapshot();assert.equal(driver(s).translatorTicks,16);assert.equal(motor(s).idealAngle,19.8);save('reset-home',s);}finally{f.h.dispose();}
});
test('SLEEP ignores STEP, wake selects Home and requires the 1 ms start interval',()=>{
 const f=fixture();try{f.pulse(10);f.set(6,0);f.time(10);f.pulse(3);let s=f.snapshot();assert.equal(driver(s).ignored,3);assert(!driver(s).enabled);f.set(6,1);f.time(10);f.pulse(1);s=f.snapshot();assert.equal(driver(s).translatorTicks,0);assert.equal(driver(s).rejected,1);f.time(1000);f.pulse(1);s=f.snapshot();assert.equal(driver(s).translatorTicks,16);assert.equal(motor(s).idealAngle,19.8);}finally{f.h.dispose();}
});
test('unlisted MS combinations are explicitly rejected instead of interpreted as 1/16',()=>{
 for(const bits of [4,5,6]){const f=fixture();try{f.mode(bits);f.pulse();const s=f.snapshot();assert.equal(driver(s).accepted,0);assert.equal(driver(s).rejected,1);assert.equal(motor(s).idealAngle,0);assert(s.diagnostics.some(d=>d.code==='stepper-timing'));}finally{f.h.dispose();}}
});
test('STEP HIGH and LOW shorter than 1 us cannot produce valid model movement',()=>{
 const f=fixture();try{f.pulse(1,.5,10);let s=f.snapshot();assert.equal(driver(s).accepted,0);assert.equal(driver(s).rejected,1);f.pulse(1,10,.5);f.pulse();s=f.snapshot();assert.equal(driver(s).accepted,1);assert.equal(driver(s).rejected,2);assert.equal(motor(s).idealAngle,1.8);}finally{f.h.dispose();}
});
test('STEP is recognized once at a rising edge, validated on sustained HIGH, not by repeated frames',()=>{
 const f=fixture();try{f.set(2,1);f.time(5);let s=f.snapshot();assert.equal(driver(s).accepted,1);for(let i=0;i<10;i++){f.time(100);s=f.snapshot();}assert.equal(driver(s).accepted,1);assert.equal(motor(s).angle,1.8);}finally{f.h.dispose();}
});
test('200 ns setup and hold failures are rejected without a phantom step',()=>{
 const f=fixture();try{f.set(3,0);f.time(.1);f.pulse();let s=f.snapshot();assert.equal(driver(s).accepted,0);assert.equal(driver(s).rejected,1);f.time(10);f.set(2,1);f.time(.1);f.set(3,1);f.time(10);f.set(2,0);s=f.snapshot();assert.equal(driver(s).accepted,0);assert.equal(driver(s).rejected,2);assert.equal(motor(s).idealAngle,0);}finally{f.h.dispose();}
});
test('mode change at a noncommon position is blocked with an explicit limitation',()=>{
 const f=fixture();try{f.mode(7);f.pulse();assert.equal(driver(f.snapshot()).translatorTicks,1);f.mode(0);f.pulse();const s=f.snapshot();assert.equal(driver(s).accepted,1);assert.equal(driver(s).rejected,1);assert.match(driver(s).lastFault,/zajedničkom/);}finally{f.h.dispose();}
});
test('internal MS pull-downs choose full steps when all MS wires are removed',()=>{
 const f=fixture(S3,c=>{c.wires=c.wires.filter(w=>!['MS1','MS2','MS3'].includes(w.to.pin));});try{f.pulse(10);const s=f.snapshot();assert.equal(driver(s).resolution,1);assert.equal(motor(s).angle,18);}finally{f.h.dispose();}
});
test('unconnected STEP/DIR/ENABLE/RESET/SLEEP cannot silently create a valid drive',()=>{
 for(const pin of ['STEP','DIR','ENABLE','RESET','SLEEP']){const f=fixture(S3,c=>{c.wires=c.wires.filter(w=>w.to.pin!==pin);});try{f.pulse(10);const s=f.snapshot();assert.equal(driver(s).accepted,0,pin);assert.equal(motor(s).idealAngle,0,pin);}finally{f.h.dispose();}}
});
test('missing VDD, VMOT or common ground prevents motor movement',()=>{
 for(const pin of ['VDD','VMOT','GND']){const f=fixture(S3,c=>{c.wires=c.wires.filter(w=>!(w.to.component==='stepperDriver'&&w.to.pin===pin));});try{f.pulse(10);const s=f.snapshot();assert.equal(motor(s).idealAngle,0,pin);assert(!driver(s).enabled,pin);if(pin==='VMOT')assert.equal(driver(s).accepted,10);}finally{f.h.dispose();}}
});
test('one reversed coil or phase swap reverses direction; two reversed coils preserve it',()=>{
 for(const [kind,sign]of [['one',-1],['two',1],['swap',-1]]as const){const f=fixture(S3,c=>{for(const w of c.wires.filter(w=>w.to.component==='stepperMotor')){if(kind==='swap')w.to.pin=w.to.pin.startsWith('A')?w.to.pin.replace('A','B'):w.to.pin.replace('B','A');else if(kind==='two'||w.to.pin.startsWith('A'))w.to.pin=w.to.pin.endsWith('+')?w.to.pin.replace('+','-'):w.to.pin.replace('-','+');}});try{f.pulse(50);assert.equal(motor(f.snapshot()).angle,sign*90);}finally{f.h.dispose();}}
});
test('crossed coil pairs, output shorts and GPIO motor connections are rejected before running',()=>{
 for(const kind of ['pairs','short','gpio','supply']){const c=stepperCircuit('stepperBasic');if(kind==='pairs')for(const w of c.wires.filter(w=>w.to.component==='stepperMotor')){if(w.to.pin==='A-')w.to.pin='B+';else if(w.to.pin==='B+')w.to.pin='A-';}if(kind==='short')c.wires.push({id:'short',from:{component:'stepperDriver',pin:'1A'},to:{component:'stepperDriver',pin:'1B'},color:'#334155',points:[]});if(kind==='gpio')c.wires.find(w=>w.to.component==='stepperMotor')!.from={component:c.components[0].id,pin:terminals(c.components[0]).find(t=>t.gpio===10)!.pin};if(kind==='supply')c.wires.push({id:'short',from:{component:'stepperDriver',pin:'1A'},to:{component:'stepperSupply',pin:'+'},color:'#334155',points:[]});assert.throws(()=>compileCircuit(c),Error,kind);}
});
test('Nano A6 and incompatible ESP32 VDD logic levels are rejected',()=>{
 const n=stepperCircuit('stepperBasic',NANO);n.wires.find(w=>w.to.pin==='STEP')!.from.pin='A6';assert.throws(()=>compileCircuit(n,'avr'),/digitalne/);
 const c=stepperCircuit('stepperBasic');c.wires.find(w=>w.to.pin==='VDD')!.from.pin=terminals(c.components[0]).find(t=>t.role==='5v')!.pin;assert.throws(()=>compileCircuit(c),/0,7/);
});
test('5 V control HIGH with 3.3 V VDD follows independent 5.5 V input limit and relative threshold',()=>{
 const f=fixture(UNO,c=>{c.wires.find(w=>w.to.pin==='VDD')!.from.pin='3V3';});try{f.pulse(50);assert.equal(motor(f.snapshot()).angle,90);}finally{f.h.dispose();}
});
test('disconnected phase and arbitrary console angle cannot move the motor model',async()=>{
 const c=stepperCircuit('stepperBasic');c.wires=c.wires.filter(w=>!(w.to.component==='stepperMotor'&&w.to.pin==='A+'));
 const s=python('stepperBasic',stepperExamples.stepperBasic.code,c);try{await s.wait((s:Session)=>s.text.includes('STEPPER +90')||s.status==='error');assert.notEqual(s.status,'error',s.text);const f=frame(s.events);assert.equal(driver(f).accepted,50);assert.equal(motor(f).idealAngle,0);assert(!motor(f).connected);}finally{await s.stop();}
});
test('two drivers and motors maintain independent step counts and phase topology',()=>{
 const f=fixture(S3,c=>{
  const second=structuredClone(c);for(const p of second.components.filter(p=>p.kind==='a4988'||p.kind==='stepperMotor')){p.id+='2';p.label+=' 2';c.components.push(p);}
  for(const w of second.wires.filter(w=>w.to.component==='stepperDriver'||w.to.component==='stepperMotor')){
   w.id+='x';for(const end of [w.from,w.to])if(end.component==='stepperDriver'||end.component==='stepperMotor')end.component+='2';
   if(w.from.component===c.components[0].id&&['STEP','DIR','ENABLE','RESET','SLEEP','MS1','MS2','MS3'].includes(w.to.pin)){const n=['STEP','DIR','ENABLE','RESET','SLEEP','MS1','MS2','MS3'].indexOf(w.to.pin)+10;w.from.pin=terminals(c.components[0]).find(t=>t.gpio===n)!.pin;}
   c.wires.push(w);
  }
 });try{for(const [p,v]of [[10,0],[11,0],[12,0],[13,1],[14,1],[15,0],[16,0],[17,0]])f.h.mode(p,1,0,v);f.time(2000);f.pulse(10);for(let n=0;n<20;n++){f.set(10,1);f.time(10);f.set(10,0);f.time(10);}const s=f.snapshot();assert.equal(motor(s).angle,18);assert.equal(s.steppers!.motors.stepperMotor2.angle,-36);assert.equal(s.steppers!.drivers.stepperDriver2.accepted,20);save('independent-motors',s);}finally{f.h.dispose();}
});
test('an edited MicroPython source changes pulses despite unchanged console wording',async()=>{
 const code=stepperExamples.stepperBasic.code.replace('pulse(50)','pulse(25)');const s=python('stepperBasic',code);try{await s.wait((s:Session)=>s.text.includes('STEPPER +90')||s.status==='error');assert.notEqual(s.status,'error',s.text);assert.equal(motor(frame(s.events)).angle,45);save('python-edited-source',{console:s.text,frame:frame(s.events)});}finally{await s.stop();}
});
for(const key of keys)test(`actual MicroPython ${key} performs GPIO protocol and Stop preserves its result`,async()=>{
 const marker={stepperBasic:'STEPPER +90',stepperMicro:'MICRO 1/16 +18',stepperControl:'CONTROL WAKE translator=5'}[key],s=python(key);
 try{await s.wait((s:Session)=>s.text.includes(marker)||s.status==='error',30000);assert.notEqual(s.status,'error',s.text);const f=frame(s.events);assert.equal(driver(f).rejected,0);if(key==='stepperBasic')assert.equal(motor(f).angle,90);if(key==='stepperMicro'){assert.equal(driver(f).resolution,16);assert.equal(motor(f).angle,18);}if(key==='stepperControl'){assert.equal(driver(f).translatorTicks,80);assert.equal(motor(f).idealAngle,27);assert(!motor(f).positionCertain);assert.equal(driver(f).ignored,6);}save('python-'+key,{console:s.text,frame:f});const before=JSON.stringify(f);assert(await s.stop()<500);assert.equal(JSON.stringify(frame(s.events)),before);}finally{await s.stop();}
});
for(const board of [UNO,NANO]as const)for(const key of keys)test(`${board}: actual compiled ${key} drives the translator and bipolar motor`,()=>{
 const a=JSON.parse(readFileSync('public/avr-examples.json','utf8'))[board][key],events:any[]=[],e=new AVREngine(a.hex,compileCircuit(stepperCircuit(key,board),'avr'),(v:any)=>events.push(v),board===NANO?8:6,a.staticRamBytes);
 try{const marker={stepperBasic:'STEPPER +90',stepperMicro:'MICRO 1/16 +18',stepperControl:'CONTROL WAKE translator=5'}[key];for(let i=0;i<1200&&!text(events).includes(marker);i++)advance(e,10);assert(text(events).includes(marker),text(events));const s=frame(events);assert.equal(driver(s).rejected,0,driver(s).lastFault);if(key==='stepperBasic')assert.equal(motor(s).angle,90);if(key==='stepperMicro'){assert.equal(driver(s).resolution,16);assert.equal(motor(s).angle,18);}if(key==='stepperControl'){assert.equal(driver(s).translatorTicks,80);assert.equal(motor(s).idealAngle,27);assert.equal(driver(s).ignored,6);}save((board===UNO?'uno-':'nano-')+key,{flashBytes:a.flashBytes,staticRamBytes:a.staticRamBytes,console:text(events),frame:s});}finally{e.dispose();}
});
test('trace remains bounded, fresh sessions reset counters and functional PWM is explicitly unsupported',()=>{
 const f=fixture();try{f.pulse(160);assert.equal(driver(f.snapshot()).trace.length,128);f.h.pwm(2,1000,32768);assert(f.snapshot().diagnostics.some(d=>d.message.includes('PWM na STEP')));}finally{f.h.dispose();}const g=fixture();try{assert.equal(driver(g.snapshot()).accepted,0);assert.equal(motor(g.snapshot()).angle,0);}finally{g.h.dispose();}
});
test('relay contact shorting an enabled A4988 output to ground is diagnosed at runtime',()=>{
 const f=fixture(S3,c=>{const r=makePart('relay',1000,600,'guard');c.components.push(r);const b=c.components[0],wire=(a:string,p:string,z:string,q:string)=>c.wires.push({id:'guard'+c.wires.length,from:{component:a,pin:p},to:{component:z,pin:q},color:'#087f8c',points:[]});
  wire(b.id,terminals(b).find(t=>t.role==='5v')!.pin,r.id,'VCC');wire(b.id,terminals(b).find(t=>t.role==='3v3')!.pin,r.id,'LV');wire(b.id,terminals(b).find(t=>t.role==='ground')!.pin,r.id,'GND');wire(b.id,terminals(b).find(t=>t.gpio===10)!.pin,r.id,'IN');wire('stepperDriver','1A',r.id,'COM');wire(r.id,'NO',r.id,'GND');
 });try{f.pulse();assert.equal(f.h.mode(10,1,0,0),-2);assert(f.snapshot().diagnostics.some(d=>d.code==='stepper-output-conflict'));}finally{f.h.dispose();}
});
test('the production Nano Worker runs A4988 and terminates within 500 ms',async()=>{
 const manifest=JSON.parse(readFileSync('dist/offline-package.json','utf8')),asset=manifest.files.find((f:any)=>/^\/assets\/avrWorker-.*\.js$/.test(f.url)),a=JSON.parse(readFileSync('public/avr-examples.json','utf8'))[NANO].stepperBasic,events:any[]=[];
 assert(asset);const w=new Worker(new URL('./avr-built-worker.mjs',import.meta.url),{workerData:{path:pathToFileURL(resolve('dist'+asset.url)).href}});
 try{await new Promise<void>((ok,bad)=>{const timer=setTimeout(()=>bad(Error('production Worker timeout')),20000);w.on('message',e=>{events.push(e);if(e.type==='error'){clearTimeout(timer);bad(Error(e.message));}else if(text(events).includes('STEPPER +90')&&frame(events)?.steppers?.motors.stepperMotor.angle===90){clearTimeout(timer);ok();}});w.on('error',bad);w.postMessage({type:'run',session:150,hex:a.hex,circuit:compileCircuit(stepperCircuit('stepperBasic',NANO),'avr'),adcChannels:8,staticRamBytes:a.staticRamBytes});});const at=performance.now();await w.terminate();const stopMs=performance.now()-at;assert(stopMs<500);save('production-worker',{version:manifest.version,build:manifest.build,stopMs,console:text(events),frame:frame(events),scope:'Node/Linux production Worker bundle'});}finally{await w.terminate();}
});
