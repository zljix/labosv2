import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {Worker} from 'node:worker_threads';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {necEnvelope} from '../public/infrared.mjs';
import {createCircuitHost} from '../public/circuit-host.mjs';
import {irCircuit,irExamples,type IRExample} from '../src/circuit/irExamples';
import {makePart,parseCircuit,terminals,type Circuit} from '../src/circuit/model';
import {checkCircuit} from '../src/circuit/netlist';
import {compileCircuit,type SimulationFrame} from '../src/circuit/compile';
import {newProject,parseProject} from '../src/project/model';
import {exportZip,importProject} from '../src/project/archive';
import {arduinoExampleProject} from '../src/runtime/arduinoExamples';
import {validateArtifact,AVR_BUILD_FILE} from '../public/avr-contract.mjs';
import {AVREngine} from '../src/runtime/avrEngine';
import {S3,UNO,NANO,type BoardId} from '../src/boards/profiles';
import {Session} from '../dist/session.mjs';
import {compileProject} from '../scripts/avr-compile.mjs';
const machine=readFileSync('public/machine.py','utf8'),driver=readFileSync('public/drivers/lab_ir.py','utf8');
const artifacts=JSON.parse(readFileSync('public/avr-examples.json','utf8'));
const keys=Object.keys(irExamples) as IRExample[];
mkdirSync('docs/stage13b-evidence',{recursive:true});
const text=(e:any[])=>e.filter(e=>e.type==='console').map(e=>e.text).join('');
const frame=(e:any[])=>e.filter(e=>e.type==='simulation').at(-1) as SimulationFrame;
const save=(name:string,value:any)=>writeFileSync('docs/stage13b-evidence/'+name+'.json',JSON.stringify(value,null,2)+'\n');
function fixture(key:IRExample='irNEC',edit=(c:Circuit)=>{},board:BoardId=S3){
 const c=irCircuit(key,board);edit(c);let now=0;const events:any[]=[];
 const h=createCircuitHost((e:any)=>events.push(e),{circuit:compileCircuit(c,board===S3?'micropython':'avr'),logicVoltage:board===S3?3.3:5,nowUs:()=>now,manualPublish:true});
 const pin=board===S3?4:2;h.mode(pin,0);return{h,c,pin,events,at:(us:number)=>{now=us;h.timedStep();h.read(pin);},frame:()=>{h.flush();return frame(events);}};
}
const factory=()=>{const w=new Worker(new URL('./node-worker.mjs',import.meta.url)),shim:any={postMessage:(d:any)=>w.postMessage(d),terminate:()=>w.terminate()};w.on('message',data=>shim.onmessage?.({data}));w.on('error',error=>shim.onerror?.(error));return shim;};
function python(key:IRExample,code:string=irExamples[key].code,c=irCircuit(key)){return new Session(factory,machine,code,{circuit:compileCircuit(c)},undefined,{'lab_ir.py':driver});}
const send=(s:Session,id:number,command=69,hold=0,extra={})=>s.input({component:'irRemote',irPress:id,irCommand:command,irHoldMs:hold,...extra});
function avr(key:IRExample,board:typeof UNO|typeof NANO,edit=(c:Circuit)=>{}){const c=irCircuit(key,board);edit(c);const a=artifacts[board][key],events:any[]=[];const e=new AVREngine(a.hex,compileCircuit(c,'avr'),(x:any)=>events.push(x),board===NANO?8:6,a.staticRamBytes);return{e,events};}
function advance(e:AVREngine,ms=300){for(let n=0;n<ms;n+=10){e.runCycles(160000);e.frame();}}

test('NEC envelope has LSB byte order, inverse bytes, exact timings and special repeat',()=>{
 const full=necEnvelope(0x12,0x45);assert.equal(full.length,67);assert.equal(full.reduce((s:any,e:any)=>s+e.durationUs,0),68062.5);
 assert.deepEqual(full.slice(0,4),[{level:0,durationUs:9000},{level:1,durationUs:4500},{level:0,durationUs:562.5},{level:1,durationUs:562.5}]);
 const bytes=[0,0,0,0];for(let bit=0;bit<32;bit++)if(full[3+bit*2].durationUs>1000)bytes[bit>>3]|=1<<(bit%8);assert.deepEqual(bytes,[0x12,0xed,0x45,0xba]);
 assert.deepEqual(necEnvelope(0,0,true),[{level:0,durationUs:9000},{level:1,durationUs:2250},{level:0,durationUs:562.5}]);
});
test('four IR examples on three boards preserve source, profiles and artifact through JSON/ZIP',async()=>{
 for(const board of [S3,UNO,NANO]as const)for(const key of keys){const p=board===S3?newProject(irExamples[key].code,irExamples[key].title):arduinoExampleProject(key,board);p.circuit=irCircuit(key,board);if(board===S3)p.files['lab_ir.py']=driver;else{await validateArtifact(p,artifacts[board][key]);p.files[AVR_BUILD_FILE]=JSON.stringify(artifacts[board][key]);}
  assert.equal(checkCircuit(p.circuit).diagnostics.length,0);assert.deepEqual(parseCircuit(p.circuit),p.circuit);const imported=importProject(exportZip(p),'ir.zip');assert.deepEqual(imported,parseProject(p));if(board!==S3)await validateArtifact(imported,JSON.parse(imported.files[AVR_BUILD_FILE]));}
});
test('IR parser rejects malformed groups, voltage, address, command, hold and faults',()=>{
 for(const [id,key,value]of [['irRx','irChannel',0],['irRx','irChannel',17],['irRx','moduleVoltage',4],['irRx','irBlocked',1],['irRemote','irAddress',256],['irRemote','irCommand',-1],['irRemote','irHoldMs',2001],['irRemote','irFault','nec2']]as const){const c=irCircuit('irNEC');(c.components.find(p=>p.id===id)!.properties as any)[key]=value;assert.throws(()=>parseCircuit(c));}
});
test('remote causes wired active LOW GPIO pulses, exact edges and 110 ms repeat starts',()=>{
 const f=fixture();try{assert.equal(f.h.read(4),1);f.h.input({component:'irRemote',irPress:1,irHoldMs:350});f.at(10000);assert.equal(f.h.read(4),0);f.at(19000);assert.equal(f.h.read(4),1);f.at(23500);assert.equal(f.h.read(4),0);f.at(400000);const s=f.frame().infrared!;assert.equal(s.irRemote.presses,1);assert.equal(s.irRemote.trace.filter(t=>t.level===0).length,40);assert.deepEqual(s.irRx.trace,s.irRemote.trace.map((t,i)=>t));assert.equal(s.irRx.transitions,80);assert(!s.irRemote.busy);save('waveform',{frame:f.frame()});}finally{f.h.dispose();}
});
test('unpowered, missing ground, disconnected OUT, blocked or different optical group do not inject commands',()=>{
 for(const option of ['VCC','GND','OUT','blocked','group']){const f=fixture('irNEC',c=>{if(['VCC','GND','OUT'].includes(option))c.wires=c.wires.filter(w=>w.to.pin!==option);if(option==='blocked')c.components[1].properties.irBlocked=true;if(option==='group')c.components[2].properties.irChannel=2;});try{f.h.input({component:'irRemote',irPress:1});f.at(10000);assert.notEqual(f.h.read(4),0,option);if(option==='VCC'||option==='GND')assert(!f.frame().infrared!.irRx.powered);if(option==='OUT')assert(f.frame().diagnostics.some(d=>d.code==='ir-signal-open'));}finally{f.h.dispose();}}
});
test('IR voltage domains and Nano analog-only pins are checked before run',()=>{
 const high=irCircuit('irNEC');high.components[1].properties.moduleVoltage=5;high.wires.find(w=>w.to.pin==='VCC')!.from.pin='J1.21';assert.throws(()=>compileCircuit(high),/pull-up na 5 V/);
 const wrong=irCircuit('irNEC');wrong.wires.find(w=>w.to.pin==='VCC')!.from.pin='J1.21';assert.throws(()=>compileCircuit(wrong),/3,3 V/);
 const nano=irCircuit('irNEC',NANO);nano.wires.find(w=>w.to.pin==='OUT')!.from.pin='A6';assert(checkCircuit(nano).diagnostics.some(d=>d.code==='ir-digital-pin'));
});
test('receiver open collector has resistive pull-up and detects actively driven HIGH conflict',()=>{
 const f=fixture('irNEC',c=>{const r=makePart('resistor',900,300,'load');r.properties.resistance=30000;c.components.push(r);for(const [a,b]of [['1','OUT'],['2','GND']])c.wires.push({id:'load'+a,from:{component:r.id,pin:a},to:{component:'irRx',pin:b},color:'#334155',points:[]});});try{assert.equal(f.h.read(4),-3);const net=f.c;assert(net);f.h.mode(4,1,0,1);f.h.input({component:'irRemote',irPress:1});f.at(10000);assert.equal(f.h.electricalStatus(),-2);assert(f.frame().diagnostics.some(d=>d.code==='ir-output-conflict'));}finally{f.h.dispose();}
});
test('transmitter requires valid carrier, supply and optical path; steady HIGH and wrong frequency fail',()=>{
 const f=fixture('irTransmit');try{f.h.mode(5,1,0,1);assert.equal(f.h.read(4),1);f.h.pwm(5,1000,21845);assert.equal(f.h.read(4),1);f.h.pwm(5,38000,21845);assert.equal(f.h.read(4),0);f.h.pwm(5,38000,60000);assert.equal(f.h.read(4),1);f.h.pwm(5,38000,21845);f.h.input({component:'irRx',irBlocked:true});assert.equal(f.h.read(4),1);f.h.input({component:'irRx',irBlocked:false});assert.equal(f.h.read(4),0);f.h.pwm(5,38000,0);assert.equal(f.h.read(4),1);}finally{f.h.dispose();}
 for(const option of ['VCC','GND','SIG','group']){const f=fixture('irTransmit',c=>{if(option==='group')c.components[2].properties.irChannel=2;else c.wires=c.wires.filter(w=>!(w.to.component==='irTx'&&w.to.pin===option));});try{f.h.pwm(5,38000,21845);assert.equal(f.h.read(4),1,option);}finally{f.h.dispose();}}
});
test('remote live input validation, duplicate presses and queue limit do not modify saved circuit',()=>{
 const f=fixture();try{for(const irPress of [NaN,Infinity,-1,1.1])f.h.input({component:'irRemote',irPress});assert.equal(f.frame().infrared!.irRemote.presses,0);f.h.input({component:'irRemote',irPress:1,irCommand:256,irHoldMs:2001,irFault:'x'});f.h.input({component:'irRemote',irPress:1});assert.equal(f.frame().infrared!.irRemote.presses,1);for(let i=2;i<=12;i++)f.h.input({component:'irRemote',irPress:i});assert.throws(()=>f.h.input({component:'irRemote',irPress:13}),/pričekaj/);assert.equal(f.c.components[2].properties.irCommand,69);}finally{f.h.dispose();}
});
for(const key of ['irNEC','irPulses','irLED']as const)test(`real MicroPython ${key}: pulses decode, repeats, address filter or LED and stop`,async()=>{
 const s=python(key);try{await s.wait((s:Session)=>s.text.includes('IR READY'));send(s,1);await s.wait((s:Session)=>s.text.includes(key==='irLED'?'LED=50':'NEC A=0 C=69 R=0'));
  send(s,2,70,350);await s.wait((s:Session)=>s.text.includes(key==='irLED'?'LED=90 R=1':'NEC A=0 C=70 R=1'));
  if(key==='irLED'){send(s,3,69,0,{irAddress:1});await s.wait((s:Session)=>frame(s.events)?.infrared?.irRemote.presses===3&&!frame(s.events)?.infrared?.irRemote.busy);assert(!s.text.includes('LED=0 R=0'));send(s,4,21,0,{irAddress:0});await s.wait((s:Session)=>s.text.includes('LED=80 R=0'));assert(frame(s.events).leds.irLED.brightness>.1);}
  if(key==='irPulses')assert(s.text.includes('IR PULSES'));
  save('python-'+key,{console:s.text,frame:frame(s.events)});
 }finally{assert(await s.stop()<500);}
});
test('real MicroPython rejects inverse and timing faults, then resynchronizes on a valid frame',async()=>{
 const s=python('irNEC');try{await s.wait((s:Session)=>s.text.includes('IR READY'));send(s,1,69,0,{irFault:'inverse'});await s.wait((s:Session)=>s.text.includes('inverzni'));assert(!s.text.includes('NEC A='));send(s,2,70,0,{irFault:'timing'});await s.wait((s:Session)=>frame(s.events)?.infrared?.irRemote.presses===2&&!frame(s.events)?.infrared?.irRemote.busy);assert(!s.text.includes('NEC A='));send(s,3,21,0,{irFault:'none'});await s.wait((s:Session)=>s.text.includes('NEC A=0 C=21 R=0'));save('python-invalid',{console:s.text,frame:frame(s.events)});}finally{await s.stop();}
});
test('real MicroPython transmitter emits PWM NEC waveform through the paired receiver',async()=>{
 const s=python('irTransmit');try{await s.wait((s:Session)=>s.text.includes('IR TX A=0 C=69'));const f=frame(s.events).infrared!;assert(f.irRx.transitions>=68);assert(f.irRx.powered);const trace=f.irRx.trace;assert(trace.some((t,i)=>i&&t.level===1&&Math.abs(t.timeUs-trace[i-1].timeUs-9000)<100));save('python-transmitter',{console:s.text,frame:frame(s.events)});}finally{assert(await s.stop()<500);}
});
test('slow MicroPython polling loses a frame instead of receiving a decoded command from the model',async()=>{
 const s=python('irNEC',irExamples.irNEC.code.replace('sleep_ms(1)','sleep_ms(500)'));try{await s.wait((s:Session)=>s.text.includes('IR READY'));send(s,1);await s.wait((s:Session)=>frame(s.events)?.infrared?.irRemote.presses===1&&!frame(s.events)?.infrared?.irRemote.busy);assert(!s.text.includes('NEC A='));}finally{await s.stop();}
});
for(const board of [UNO,NANO]as const)test(`${board}: real compiled NEC INT0 receiver, repeats, errors and PWM LED`,()=>{
 const records=[];for(const key of ['irPulses','irNEC','irLED']as const){const t=avr(key,board);try{advance(t.e,150);t.e.input({component:'irRemote',irPress:1,irCommand:69,irHoldMs:0});advance(t.e,180);assert(text(t.events).includes(key==='irLED'?'LED=50 R=0':'NEC A=0 C=69 R=0'),text(t.events));
  t.e.input({component:'irRemote',irPress:2,irCommand:70,irHoldMs:350});advance(t.e,500);assert(text(t.events).includes(key==='irLED'?'LED=90 R=1':'NEC A=0 C=70 R=1'),text(t.events));
  const before=text(t.events);t.e.input({component:'irRemote',irPress:3,irCommand:21,irHoldMs:0,irFault:'inverse'});advance(t.e,180);assert(!text(t.events).slice(before.length).includes(key==='irLED'?'LED=':'NEC A='));
  t.e.input({component:'irRemote',irPress:4,irCommand:70,irHoldMs:350,irFault:'timing'});advance(t.e,500);assert(!text(t.events).slice(before.length).includes(key==='irLED'?'LED=':'NEC A='));
  t.e.input({component:'irRemote',irPress:5,irCommand:21,irHoldMs:0,irFault:'none'});advance(t.e,180);assert(text(t.events).includes(key==='irLED'?'LED=80 R=0':'NEC A=0 C=21 R=0'));
  assert.equal(frame(t.events).diagnostics.length,0);records.push({key,console:text(t.events),frame:frame(t.events)});
 }finally{t.e.dispose();}}save(board===UNO?'uno-receivers':'nano-receivers',records);
});
for(const board of [UNO,NANO]as const)test(`${board}: Timer2 carrier and real simultaneous INT0 loopback decode`,()=>{
 const t=avr('irTransmit',board);try{advance(t.e,180);assert(text(t.events).includes('NEC A=0 C=69 R=0'),text(t.events));advance(t.e,1150);assert(text(t.events).includes('NEC A=0 C=70 R=0'),text(t.events));assert(frame(t.events).infrared!.irRx.transitions>=136);assert.equal(frame(t.events).diagnostics.length,0);save(board===UNO?'uno-transmitter':'nano-transmitter',{console:text(t.events),frame:frame(t.events)});}finally{t.e.dispose();}
});
test('production Nano Worker receives live NEC, repeat and stops promptly',async()=>{
 const manifest=JSON.parse(readFileSync('dist/offline-package.json','utf8')),asset=manifest.files.find((f:any)=>/^\/assets\/avrWorker-.*\.js$/.test(f.url));assert(asset);const a=artifacts[NANO].irNEC,events:any[]=[];
 const w=new Worker(new URL('./avr-built-worker.mjs',import.meta.url),{workerData:{path:pathToFileURL(resolve('dist'+asset.url)).href}});
 let pending:{check:()=>boolean;done:()=>void;fail:(e:Error)=>void}|undefined;
 const wait=(check:()=>boolean)=>new Promise<void>((ok,bad)=>{if(check()){ok();return;}const timer=setTimeout(()=>{pending=undefined;bad(Error('Worker timeout '+text(events)));},20000);pending={check,done:()=>{clearTimeout(timer);pending=undefined;ok();},fail:e=>{clearTimeout(timer);pending=undefined;bad(e);}};});
 w.on('message',e=>{events.push(e);if(e.type==='error')pending?.fail(Error(e.message));else if(pending?.check())pending.done();});w.on('error',e=>pending?.fail(e));
 try{w.postMessage({type:'run',session:132,hex:a.hex,circuit:compileCircuit(irCircuit('irNEC',NANO),'avr'),adcChannels:8,staticRamBytes:a.staticRamBytes});await wait(()=>text(events).includes('IR READY'));w.postMessage({type:'input',session:132,component:'irRemote',irPress:1,irCommand:70,irHoldMs:350});await wait(()=>text(events).includes('NEC A=0 C=70 R=1'));const at=performance.now();await w.terminate();const stopMs=performance.now()-at;assert(stopMs<500);save('production-worker',{version:manifest.version,build:manifest.build,console:text(events),stopMs,scope:'Node/Linux production bundle'});}finally{await w.terminate();}
});


test('independent receivers and remotes use separate GPIO nets and optical groups; fresh run clears pending edges',()=>{
 const f=fixture('irNEC',c=>{const rx=makePart('irReceiver',900,400,'irRx2'),remote=makePart('irRemote',1200,400,'remote2');rx.properties.irChannel=2;remote.properties.irChannel=2;c.components.push(rx,remote);for(const pin of ['VCC','GND'])c.wires.push({id:'rx2'+pin,from:{component:'irRx',pin},to:{component:rx.id,pin},color:'#334155',points:[]});c.wires.push({id:'rx2out',from:{component:c.components[0].id,pin:terminals(c.components[0]).find(t=>t.gpio===6)!.pin},to:{component:rx.id,pin:'OUT'},color:'#087f8c',points:[]});});
 try{f.h.mode(6,0);f.h.input({component:'irRemote',irPress:1});f.at(10000);assert.equal(f.h.read(4),0);assert.equal(f.h.read(6),1);f.h.input({component:'remote2',irPress:1,irCommand:21});f.at(20000);assert.equal(f.h.read(4),1);assert.equal(f.h.read(6),0);f.h.input({component:'irRx',irBlocked:true});f.at(400000);assert.equal(f.frame().infrared!.irRx2.transitions,68);}finally{f.h.dispose();}
 const fresh=fixture();try{assert.equal(fresh.h.nextTimedEdgeUs(),Infinity);assert.equal(fresh.frame().infrared!.irRx.transitions,0);assert.equal(fresh.frame().infrared!.irRemote.presses,0);}finally{fresh.h.dispose();}
});

test('receiver supply through a resistor follows its GPIO source instead of a stale power cache',()=>{
 const f=fixture('irNEC',c=>{c.wires=c.wires.filter(w=>w.to.pin!=='VCC');const r=makePart('resistor',600,500,'powerR');r.properties.resistance=10;c.components.push(r);c.wires.push({id:'supply1',from:{component:c.components[0].id,pin:terminals(c.components[0]).find(t=>t.gpio===6)!.pin},to:{component:r.id,pin:'1'},color:'#d04b46',points:[]},{id:'supply2',from:{component:r.id,pin:'2'},to:{component:'irRx',pin:'VCC'},color:'#d04b46',points:[]});});
 try{f.h.mode(6,1,0,1);assert(f.frame().infrared!.irRx.powered);f.h.mode(6,1,0,0);assert(!f.frame().infrared!.irRx.powered);f.h.mode(6,1,0,1);assert(f.frame().infrared!.irRx.powered);}finally{f.h.dispose();}
});

test('real MicroPython transmitter repeat parameter emits a full frame then two special repeats',async()=>{
 const code=`from machine import Pin\nfrom lab_ir import NECTransmitter\ntx=NECTransmitter(Pin(5))\ntx.send(18, 255, 2)\nprint("TX_REPEAT_DONE")\n`;
 const s=python('irTransmit',code);try{await s.wait((s:Session)=>s.status==='done'||s.status==='error');assert.equal(s.status,'done',s.text);const f=frame(s.events).infrared!,tr=f.irRx.trace;assert.equal(f.irRx.transitions,76);const leaders=tr.filter((t,i)=>t.level===0&&tr[i+1]&&tr[i+1].timeUs-t.timeUs>8000);assert.equal(leaders.length,3);assert(Math.abs(leaders[1].timeUs-leaders[0].timeUs-110000)<30);assert(Math.abs(leaders[2].timeUs-leaders[1].timeUs-110000)<30);save('python-tx-repeats',{console:s.text,frame:frame(s.events)});}finally{await s.stop();}
});

for(const board of [UNO,NANO]as const)test(`${board}: actual carrier rejects orphan/stale repeats and exposes unread mailbox loss`,{skip:!process.env.LAB_ARDUINO_CLI},async()=>{
 const p=arduinoExampleProject('irTransmit',board);p.files['main.ino']=`#include "lab_nec.h"\nLabNEC ir;\nvoid changed(){ir.edge(digitalRead(2));}\nvoid setup(){Serial.begin(9600);pinMode(2,INPUT);attachInterrupt(digitalPinToInterrupt(2),changed,CHANGE);LabNECSender::begin();}\nvoid loop(){uint8_t a,c;bool r;LabNECSender::repeat();delay(5);Serial.print(F("ORPHAN="));Serial.println(ir.read(a,c,r)?1:0);LabNECSender::send(18,255,2);delay(5);if(ir.read(a,c,r)){Serial.print(F("VALID="));Serial.print(a);Serial.print(',');Serial.print(c);Serial.print(',');Serial.println(r?1:0);}Serial.print(F("COUNT="));Serial.println(ir.received);Serial.print(F("OVERRUN="));Serial.println(ir.overruns);delay(200);LabNECSender::repeat();delay(5);Serial.print(F("STALE="));Serial.println(ir.read(a,c,r)?1:0);while(true){}}\n`;
 const a=await compileProject(p);await validateArtifact(p,a);const events:any[]=[],e=new AVREngine(a.hex,compileCircuit(p.circuit as Circuit,'avr'),(v:any)=>events.push(v),board===NANO?8:6,a.staticRamBytes);
 try{advance(e,700);const output=text(events);for(const line of ['ORPHAN=0','VALID=18,255,1','COUNT=3','OVERRUN=2','STALE=0'])assert(output.includes(line),output);save(board===UNO?'uno-repeat-semantics':'nano-repeat-semantics',{source:p.files['main.ino'],artifact:a,console:output,frame:frame(events)});}finally{e.dispose();}
});


test('IR software clock ignores browser pauses but a declared sleep can lose a frame',async()=>{
 const config=compileCircuit(irCircuit('irNEC')),events:any[]=[];
 const h=createCircuitHost((e:any)=>events.push(e),{circuit:config,manualPublish:true});
 try{h.mode(4,0);h.input({component:'irRemote',irPress:1});await new Promise(r=>setTimeout(r,100));assert.equal(h.timePulseUs(4,0,12000),9000);h.timePulseUs(4,1,6000);
  // Finish the first transfer without decoding it, then start a new press.
  const token=h.timingBegin();h.delayUs(100000);h.timingEnd(token);h.read(4);
  h.input({component:'irRemote',irPress:2});h.waitMs(120);await new Promise(r=>setTimeout(r,130));assert.equal(h.timePulseUs(4,0,12000),-2);h.flush();assert.equal(frame(events).clockProfile,'ir-software-us');
 }finally{h.dispose();}
});
