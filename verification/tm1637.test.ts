import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {Worker} from 'node:worker_threads';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {createCircuitHost} from '../public/circuit-host.mjs';
import {TM1637_DUTIES} from '../public/tm1637.mjs';
import {tmCircuit,tmExamples,type TMExample} from '../src/circuit/tm1637Examples';
import {compileCircuit,type SimulationFrame} from '../src/circuit/compile';
import {makePart,parseCircuit,terminals,type Circuit} from '../src/circuit/model';
import {checkCircuit} from '../src/circuit/netlist';
import {newProject,parseProject} from '../src/project/model';
import {exportZip,importProject} from '../src/project/archive';
import {arduinoExampleProject} from '../src/runtime/arduinoExamples';
import {exportSketch} from '../src/project/sketch';
import {validateArtifact,AVR_BUILD_FILE} from '../public/avr-contract.mjs';
import {AVREngine} from '../src/runtime/avrEngine';
import {S3,UNO,NANO,type BoardId} from '../src/boards/profiles';
import {Session} from '../dist/session.mjs';
import {compileProject} from '../scripts/avr-compile.mjs';
const machine=readFileSync('public/machine.py','utf8'),driver=readFileSync('public/drivers/lab_tm1637.py','utf8');
const artifacts=JSON.parse(readFileSync('public/avr-examples.json','utf8'));
const keys=Object.keys(tmExamples) as TMExample[];
mkdirSync('docs/stage13c-evidence',{recursive:true});
const save=(name:string,value:any)=>writeFileSync('docs/stage13c-evidence/'+name+'.json',JSON.stringify(value,null,2)+'\n');
const frame=(e:any[])=>e.filter(x=>x.type==='simulation').at(-1) as SimulationFrame;
const text=(e:any[])=>e.filter(x=>x.type==='console').map(x=>x.text).join('');
function fixture(board:BoardId=S3,edit=(c:Circuit)=>{}){
 const c=tmCircuit('tmCounter',board);edit(c);let now=0,step=20;const events:any[]=[];
 const h=createCircuitHost((e:any)=>events.push(e),{circuit:compileCircuit(c,board===S3?'micropython':'avr'),logicVoltage:board===S3?3.3:5,manualPublish:true,nowUs:()=>now});
 const clk=board===S3?4:2,dio=board===S3?5:3;
 const low=(p:number)=>{now+=step;return h.mode(p,1,0,0);},high=(p:number)=>{now+=step;return h.mode(p,0);};
 high(clk);high(dio);
 const start=()=>{high(dio);high(clk);low(dio);},stop=()=>{low(clk);low(dio);high(clk);high(dio);};
 const byte=(v:number,msb=false)=>{for(let i=0;i<8;i++){low(clk);(v&(1<<(msb?7-i:i))?high:low)(dio);high(clk);}low(clk);high(dio);high(clk);const ack=h.read(dio);low(clk);return ack;};
 const tx=(a:number[])=>{start();const acks=a.map(v=>byte(v));stop();return acks;};
 return {c,h,clk,dio,events,low,high,start,stop,byte,tx,step:(v:number)=>{step=v;},snapshot:()=>{h.flush();return frame(events);},state:()=>{h.flush();return frame(events).tmDisplays!.tm1;}};
}
const factory=()=>{const w=new Worker(new URL('./node-worker.mjs',import.meta.url)),shim:any={postMessage:(d:any)=>w.postMessage(d),terminate:()=>w.terminate()};w.on('message',data=>shim.onmessage?.({data}));w.on('error',error=>shim.onerror?.(error));return shim;};
function python(code:string,c=tmCircuit()){return new Session(factory,machine,code,{circuit:compileCircuit(c)},undefined,{'lab_tm1637.py':driver});}
function advance(e:AVREngine,ms=300){for(let n=0;n<ms;n+=10){e.runCycles(160000);e.frame();}}

test('four TM1637 examples on three boards round-trip source, wiring, JSON and ZIP',async()=>{
 for(const board of [S3,UNO,NANO]as const)for(const key of keys){
  const p=board===S3?newProject(tmExamples[key].code,tmExamples[key].title):arduinoExampleProject(key,board);
  p.circuit=tmCircuit(key,board);if(board===S3)p.files['lab_tm1637.py']=driver;else {await validateArtifact(p,artifacts[board][key]);p.files[AVR_BUILD_FILE]=JSON.stringify(artifacts[board][key]);}
  assert.deepEqual(parseCircuit(p.circuit),p.circuit);assert.equal(checkCircuit(p.circuit).diagnostics.length,0);
  assert.deepEqual(importProject(exportZip(p),'tm.zip'),parseProject(p));
  if(board!==S3)assert(exportSketch(p).length>100);
 }
});
test('parser validates explicit 5 V module and LV profile',()=>{
 for(const [key,value]of [['moduleVoltage',3.3],['moduleVoltage',undefined],['logicVoltage',4],['logicVoltage',undefined]]as const){const c=tmCircuit();(c.components[1].properties as any)[key]=value;assert.throws(()=>parseCircuit(c));}
});
test('actual LSB bytes, ninth ACK and address registers form 12:34',()=>{
 const f=fixture();try{assert.equal(f.h.read(f.dio),1);assert.deepEqual(f.tx([0x40]),[0]);assert.deepEqual(f.tx([0xc0,6,0xdb,0x4f,0x66]),[0,0,0,0,0]);assert.deepEqual(f.tx([0x8f]),[0]);const s=f.state();assert.deepEqual(s.bytes,[6,0xdb,0x4f,0x66,0,0]);assert(s.on&&s.colon);assert.equal(s.received,7);assert.equal(s.errors,0);assert.deepEqual(s.trace.filter(t=>t.operation==='byte').map(t=>t.value),[0x40,0xc0,6,0xdb,0x4f,0x66,0x8f]);save('protocol',{frame:f.snapshot()});}finally{f.h.dispose();}
});
test('reversed MSB bit order cannot masquerade as a TM1637 command',()=>{
 const f=fixture();try{f.start();f.byte(0x8f,true);f.stop();assert(!f.state().on);assert.equal(f.state().errors,1);}finally{f.h.dispose();}
});
test('data remains invisible before ON; OFF retains RAM, clear overwrites it',()=>{
 const f=fixture();try{f.tx([0x40]);f.tx([0xc0,0x7f,0x7f,0x7f,0x7f]);assert(!f.state().on);f.tx([0x8f]);assert(f.state().on);f.tx([0x80]);assert(!f.state().on);assert.equal(f.state().bytes[0],0x7f);f.tx([0x88]);assert(f.state().on);assert.equal(f.state().brightness,0);f.tx([0xc0,0,0,0,0]);assert.deepEqual(f.state().bytes,[0,0,0,0,0,0]);}finally{f.h.dispose();}
});
test('all eight brightness commands use datasheet duties including nonzero level 0',()=>{
 const f=fixture();try{assert.deepEqual(TM1637_DUTIES,[1,2,4,10,11,12,13,14].map(n=>n/16));for(let n=0;n<8;n++){f.tx([0x88|n]);const s=f.state();assert(s.on);assert.equal(s.brightness,n);assert.equal(s.duty,TM1637_DUTIES[n]);}}finally{f.h.dispose();}
});
test('fixed and auto address modes, hidden C4/C5 and invalid C6 do not wrap',()=>{
 const f=fixture();try{f.tx([0x40]);f.tx([0xc0,1,2,3,4,5,6,7,8]);assert.deepEqual(f.state().bytes,[1,2,3,4,5,6]);f.tx([0x44]);f.tx([0xc1,9,10]);assert.deepEqual(f.state().bytes,[1,10,3,4,5,6]);f.tx([0xc6,0xff]);assert.deepEqual(f.state().bytes,[1,10,3,4,5,6]);}finally{f.h.dispose();}
});
test('partial byte at STOP is ignored while earlier complete bytes remain effective',()=>{
 const f=fixture();try{f.tx([0x40]);f.start();f.byte(0xc0);f.byte(6);for(let n=0;n<3;n++){f.low(f.clk);f.high(f.dio);f.high(f.clk);}f.stop();assert.deepEqual(f.state().bytes,[6,0,0,0,0,0]);assert.equal(f.state().received,3);f.tx([0xc1,0x5b]);assert.equal(f.state().bytes[1],0x5b);}finally{f.h.dispose();}
});
test('keyboard-read command is explicitly unsupported and leaves display RAM unchanged',()=>{
 const f=fixture();try{f.tx([0xc0,6]);f.tx([0x42,0xff]);const s=f.state();assert.equal(s.errors,1);assert.equal(s.bytes[0],6);assert(s.reason.includes('tipkovnice'));}finally{f.h.dispose();}
});
test('disconnected VCC, GND, LV, CLK and DIO never produce valid data and ACK',()=>{
 for(const pin of ['VCC','GND','LV','CLK','DIO']){const f=fixture(S3,c=>{c.wires=c.wires.filter(w=>w.to.pin!==pin);});try{const ack=f.tx([0x8f]);assert(ack.some(n=>n!==0),pin);assert(!f.state().on,pin);if(['VCC','GND','LV'].includes(pin))assert(!f.state().powered,pin);}finally{f.h.dispose();}}
});
test('voltage-domain, merged signal and Nano analog-only wiring checks apply',()=>{
 const high=tmCircuit();high.components[1].properties.logicVoltage=5;high.wires.find(w=>w.to.pin==='LV')!.from.pin=terminals(high.components[0]).find(t=>t.role==='5v')!.pin;assert.throws(()=>compileCircuit(high),/pull-up na 5 V/);
 const short=tmCircuit();short.wires.find(w=>w.to.pin==='DIO')!.from.pin=short.wires.find(w=>w.to.pin==='CLK')!.from.pin;assert.throws(()=>compileCircuit(short),/zasebne mreže/);
 const nano=tmCircuit('tmCounter',NANO);nano.wires.find(w=>w.to.pin==='DIO')!.from.pin='A6';assert(checkCircuit(nano).diagnostics.some(d=>d.code==='tm1637-digital-pin'));
 const wrong=tmCircuit();wrong.wires.find(w=>w.to.pin==='LV')!.from.pin=terminals(wrong.components[0]).find(t=>t.role==='5v')!.pin;assert.throws(()=>compileCircuit(wrong),/LV profila/);
});
test('10 kOhm pulls are resistive, not fixed HIGH voltage sources',()=>{
 const f=fixture(S3,c=>{const r=makePart('resistor',100,600,'load');r.properties.resistance=10000;c.components.push(r);for(const [p,q]of [['1','DIO'],['2','GND']])c.wires.push({id:'load'+p,from:{component:r.id,pin:p},to:{component:'tm1',pin:q},color:'#334155',points:[]});});try{assert.equal(f.h.read(f.dio),-3);const config=compileCircuit(f.c),net=config.tmDisplays[0].dioNet;assert(Math.abs(f.h.sample().volts[net]-1.65)<.01);}finally{f.h.dispose();}
});
test('active HIGH against slave LOW ACK produces a conflict',()=>{
 const f=fixture();try{f.start();for(let i=0;i<8;i++){f.low(f.clk);f.low(f.dio);f.high(f.clk);}f.low(f.clk);assert.equal(f.h.mode(f.dio,1,0,1),-2);assert(f.snapshot().diagnostics.some(d=>d.code==='tm1637-output-conflict'));}finally{f.h.dispose();}
});
test('pre-fast clock is rejected and a later normal START resynchronizes',()=>{
 const f=fixture();try{f.step(.01);f.tx([0x8f]);assert(!f.state().on);assert(f.state().errors>0);f.step(20);f.tx([0x8f]);assert(f.state().on);}finally{f.h.dispose();}
});
test('independent TM1637 instances use their own GPIO nets; shared pair is diagnosed',()=>{
 const f=fixture(S3,c=>{const d=makePart('tm1637',900,400,'tm2');c.components.push(d);for(const pin of ['VCC','GND','LV'])c.wires.push({id:'tm2'+pin,from:{component:'tm1',pin},to:{component:'tm2',pin},color:'#334155',points:[]});for(const [pin,gpio]of [['CLK',6],['DIO',7]]as const)c.wires.push({id:'tm2'+pin,from:{component:c.components[0].id,pin:terminals(c.components[0]).find(t=>t.gpio===gpio)!.pin},to:{component:'tm2',pin},color:'#087f8c',points:[]});});
 try{f.tx([0x8f]);assert(f.snapshot().tmDisplays!.tm1.on);assert(!f.snapshot().tmDisplays!.tm2.on);const c=structuredClone(f.c);for(const pin of ['CLK','DIO'])c.wires.find(w=>w.id==='tm2'+pin)!.from={component:'tm1',pin};assert(checkCircuit(c).diagnostics.some(d=>d.code==='tm1637-shared-bus'));}finally{f.h.dispose();}
});
test('GPIO-switched supply resets RAM and ON state immediately on power loss',()=>{
 const f=fixture(S3,c=>{c.wires=c.wires.filter(w=>w.to.pin!=='VCC');c.wires.push({id:'power',from:{component:c.components[0].id,pin:terminals(c.components[0]).find(t=>t.gpio===6)!.pin},to:{component:'tm1',pin:'VCC'},color:'#d04b46',points:[]});});
 // ESP32 GPIO cannot supply the 5 V module; the incomplete supply stays off.
 try{f.h.mode(6,1,0,1);f.tx([0x8f]);assert(!f.state().powered);}finally{f.h.dispose();}
 const a=fixture(UNO,c=>{c.wires.find(w=>w.to.pin==='VCC')!.from.pin='D6';});try{a.h.mode(6,1,0,1);a.tx([0xc0,0x7f]);a.tx([0x8f]);assert(a.state().on);a.h.write(6,0);assert(!a.state().powered);assert.deepEqual(a.state().bytes,[0,0,0,0,0,0]);a.h.write(6,1);assert(a.state().powered&&!a.state().on);}finally{a.h.dispose();}
});
test('bounded traces and fresh sessions reset state',()=>{
 const f=fixture();try{for(let n=0;n<80;n++)f.tx([0x8f]);assert.equal(f.state().trace.length,128);assert.equal(f.state().received,80);}finally{f.h.dispose();}
 const g=fixture();try{assert.equal(g.state().received,0);assert(!g.state().on);assert.equal(g.state().errors,0);}finally{g.h.dispose();}
});
for(const key of keys)test(`real MicroPython ${key} executes GPIO driver and preserves Stop results`,async()=>{
 const s=python(tmExamples[key].code,tmCircuit(key));try{
  const marker=key==='tmSegments'?'TM SEGMENT bit=1':key==='tmCounter'?'TM COUNT=-2':key==='tmClock'?'TM CLOCK=12:34':'TM BRIGHTNESS=1';
  await s.wait((s:Session)=>s.text.includes(marker)||s.status==='error');assert.notEqual(s.status,'error',s.text);assert(s.text.includes(marker),s.text);
  const d=frame(s.events).tmDisplays!.tm1;assert(d.on&&d.powered);assert.equal(d.errors,0);assert(d.received>0);assert.equal(frame(s.events).diagnostics.length,0);save('python-'+key,{console:s.text,frame:frame(s.events)});const before=JSON.stringify(d);assert(await s.stop()<500);assert.equal(JSON.stringify(frame(s.events).tmDisplays!.tm1),before);
 }finally{await s.stop();}
});
test('real MicroPython signed range, leading zeros, partial write, OFF, clear and missing ACK',async()=>{
 const prefix='from machine import Pin\nfrom lab_tm1637 import TM1637\nt=TM1637(Pin(4),Pin(5))\nt.brightness(0)\n';
 const s=python(prefix+'t.number(-999, leading_zero=True)\nprint("NEG")\nt.number(7, leading_zero=True, colon=True)\nt.segments([0x40],3)\ntry:\n t.number(10000)\nexcept ValueError:\n print("RANGE_OK")\nt.brightness(3,False)\nprint("DONE")\n');
 try{await s.wait((s:Session)=>s.status==='done'||s.status==='error');assert.equal(s.status,'done',s.text);assert(s.text.includes('RANGE_OK'));const d=frame(s.events).tmDisplays!.tm1;assert.deepEqual(d.bytes.slice(0,4),[0x3f,0xbf,0x3f,0x40]);assert(!d.on);save('python-control',{console:s.text,frame:frame(s.events)});}finally{await s.stop();}
 const c=tmCircuit();c.wires=c.wires.filter(w=>w.to.pin!=='VCC');const bad=python(prefix,c);try{await bad.wait((s:Session)=>s.status==='done'||s.status==='error');assert.equal(bad.status,'error');assert(bad.events.some((e:any)=>e.type==='error'&&e.message.includes('ACK')),JSON.stringify(bad.events.filter((e:any)=>e.type==='error')));}finally{await bad.stop();}
 const clear=python(prefix+'t.number(1234)\nt.clear()\nprint("CLEAR_OK")\n');try{await clear.wait((s:Session)=>s.status==='done'||s.status==='error');assert.equal(clear.status,'done',clear.text);assert.deepEqual(frame(clear.events).tmDisplays!.tm1.bytes,[0,0,0,0,0,0]);}finally{await clear.stop();}
});
for(const board of [UNO,NANO]as const)test(`${board}: all four actual compiled TM1637 programs run through GPIO and ACK`,()=>{
 const results=[];for(const key of keys){const a=artifacts[board][key],events:any[]=[],e=new AVREngine(a.hex,compileCircuit(tmCircuit(key,board),'avr'),(x:any)=>events.push(x),board===NANO?8:6,a.staticRamBytes);try{advance(e,750);const d=frame(events).tmDisplays!.tm1;assert(d.powered&&d.on);assert.equal(d.errors,0);assert(d.received>0);assert(!text(events).includes('ACK ERROR'),text(events));assert.equal(frame(events).diagnostics.length,0);results.push({key,console:text(events),frame:frame(events)});}finally{e.dispose();}}save(board===UNO?'uno-examples':'nano-examples',results);
});
for(const board of [UNO,NANO]as const)test(`${board}: newly compiled modified source handles bounds, fixed address, OFF and missing ACK`,{skip:!process.env.LAB_ARDUINO_CLI},async()=>{
 const p=arduinoExampleProject('tmCounter',board);p.files['main.ino']=`#include "lab_tm1637.h"\nLabTM1637 t(2,3);\nvoid setup(){Serial.begin(9600);t.begin();Serial.print(F("ACK="));Serial.println(t.brightness(0));t.number(-999,true,true);uint8_t mode=0x44,pair[2]={0xc2,0x79};t.transaction(&mode,1);t.transaction(pair,2);t.brightness(6,false);Serial.print(F("RANGE="));Serial.println(t.number(10000));Serial.println(F("DONE"));}\nvoid loop(){}\n`;
 const a=await compileProject(p);await validateArtifact(p,a);const results=[];
 for(const connected of [true,false]){const c=tmCircuit('tmCounter',board);if(!connected)c.wires=c.wires.filter(w=>w.to.pin!=='VCC');const events:any[]=[],e=new AVREngine(a.hex,compileCircuit(c,'avr'),(x:any)=>events.push(x),board===NANO?8:6,a.staticRamBytes);try{advance(e,250);assert(text(events).includes('ACK='+(connected?1:0)),text(events));assert(text(events).includes('RANGE=0'));if(connected){const d=frame(events).tmDisplays!.tm1;assert.deepEqual(d.bytes,[0x40,0xef,0x79,0x6f,0,0]);assert(!d.on);assert.equal(d.brightness,6);}results.push({connected,console:text(events),frame:frame(events)});}finally{e.dispose();}}
 save(board===UNO?'uno-modified':'nano-modified',results);
});
test('production Nano Worker runs TM1637 and terminates promptly',async()=>{
 const manifest=JSON.parse(readFileSync('dist/offline-package.json','utf8')),asset=manifest.files.find((f:any)=>/^\/assets\/avrWorker-.*\.js$/.test(f.url));assert(asset);const a=artifacts[NANO].tmCounter,events:any[]=[];
 const w=new Worker(new URL('./avr-built-worker.mjs',import.meta.url),{workerData:{path:pathToFileURL(resolve('dist'+asset.url)).href}});
 let pending:{check:()=>boolean;done:()=>void;fail:(e:Error)=>void}|undefined;
 const wait=(check:()=>boolean)=>new Promise<void>((ok,bad)=>{if(check()){ok();return;}const timer=setTimeout(()=>{pending=undefined;bad(Error('Worker timeout '+text(events)));},20000);pending={check,done:()=>{clearTimeout(timer);pending=undefined;ok();},fail:e=>{clearTimeout(timer);pending=undefined;bad(e);}};});
 w.on('message',e=>{events.push(e);if(e.type==='error')pending?.fail(Error(e.message));else if(pending?.check())pending.done();});w.on('error',e=>pending?.fail(e));
 try{w.postMessage({type:'run',session:133,hex:a.hex,circuit:compileCircuit(tmCircuit('tmCounter',NANO),'avr'),adcChannels:8,staticRamBytes:a.staticRamBytes});await wait(()=>text(events).includes('TM COUNT=-2'));assert(frame(events).tmDisplays!.tm1.on);const at=performance.now();await w.terminate();const stopMs=performance.now()-at;assert(stopMs<500);save('production-worker',{version:manifest.version,build:manifest.build,console:text(events),stopMs,scope:'Node/Linux production bundle'});}finally{await w.terminate();}
});
