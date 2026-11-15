import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Worker} from 'node:worker_threads';
import {createCircuitHost} from '../public/circuit-host.mjs';
import {DHT_PROFILES,dhtBytes} from '../public/dht-bus.mjs';
import {dhtCircuit,dhtExamples,type DHTExample} from '../src/circuit/dhtExamples';
import {compileCircuit} from '../src/circuit/compile';
import {makePart,parseCircuit,terminals,type Circuit} from '../src/circuit/model';
import {checkCircuit} from '../src/circuit/netlist';
import {S3,UNO,NANO,type BoardId} from '../src/boards/profiles';
import {newProject,parseProject} from '../src/project/model';
import {exportZip,importProject} from '../src/project/archive';
import {arduinoExampleProject} from '../src/runtime/arduinoExamples';
import {AVREngine} from '../src/runtime/avrEngine';
import {validateArtifact,AVR_BUILD_FILE} from '../public/avr-contract.mjs';
import {Session} from '../dist/session.mjs';
const machine=readFileSync('public/machine.py','utf8'),driver=readFileSync('public/drivers/dht.py','utf8');
const artifacts=JSON.parse(readFileSync('public/avr-examples.json','utf8'));
const keys=Object.keys(dhtExamples) as DHTExample[];
const frames=(events:any[])=>events.filter(e=>e.type==='simulation'),text=(events:any[])=>events.filter(e=>e.type==='console').map(e=>e.text).join('');
const remove=(c:Circuit,id:string,pin:string)=>{c.wires=c.wires.filter(w=>![w.from,w.to].some(e=>e.component===id&&e.pin===pin));};
function fixture(key:DHTExample='dht22',edit=(c:Circuit)=>{},board:BoardId=S3){
 let now=0;const c=dhtCircuit(key,board);edit(c);const events:any[]=[];
 const h=createCircuitHost((e:any)=>events.push(e),{circuit:compileCircuit(c,board===S3?'micropython':'avr'),logicVoltage:board===S3?3.3:5,manualPublish:true,nowMs:()=>now});h.flush();
 return {h,c,events,at:(ms:number)=>{now=ms;h.timedStep();},frame:()=>{h.flush();return frames(events).at(-1);}};
}
function start(h:any,pin=4,us=18000){const token=h.timingBegin();h.mode(pin,1,0,0);h.delayUs(us);h.mode(pin,0,1);return token;}
function decode(h:any,pin=4){assert(h.timePulseUs(pin,0,1000)>0);assert.equal(h.timePulseUs(pin,1,1000),80);const b=[];for(let n=0;n<5;n++){let v=0;for(let i=0;i<8;i++){const low=h.timePulseUs(pin,0,1000),high=h.timePulseUs(pin,1,1000);assert.equal(low,50);assert([27,70].includes(high));v=(v<<1)|(high>low?1:0);}b.push(v);}return b;}
const factory=()=>{const w=new Worker(new URL('./node-worker.mjs',import.meta.url)),shim:any={postMessage:(d:any)=>w.postMessage(d),terminate:()=>w.terminate()};w.on('message',data=>shim.onmessage?.({data}));w.on('error',error=>shim.onerror?.(error));return shim;};
function python(key:DHTExample,code:string,c=dhtCircuit(key)){return new Session(factory,machine,code,{circuit:compileCircuit(c)},()=>{},{'dht.py':driver});}
async function done(key:DHTExample,code:string,c=dhtCircuit(key),ok=true){const s=python(key,code,c);try{await s.wait((v:Session)=>['done','error'].includes(v.status),10000);assert.equal(s.status,ok?'done':'error',s.text+JSON.stringify(s.events.filter((e:any)=>e.type==='error')));return {text:s.text,events:s.events,frame:frames(s.events).at(-1)};}finally{await s.stop();}}
const pyPrelude='from machine import Pin\nfrom time import sleep_ms\nfrom dht import DHT11,DHT22\n';
function avr(key:DHTExample,board:typeof UNO|typeof NANO,edit=(c:Circuit)=>{}){const p=arduinoExampleProject(key,board),a=artifacts[board][key];const c=p.circuit as Circuit;edit(c);const events:any[]=[];const e=new AVREngine(a.hex,compileCircuit(c,'avr'),v=>events.push(v),board===NANO?8:6,a.staticRamBytes);return {e,events};}
function advance(e:AVREngine,ms:number){for(let n=0;n<ms;n+=10){e.runCycles(160000);e.frame();}}

test('separate documented DHT profiles and independently known byte encodings',()=>{
 assert.equal(DHT_PROFILES.dht11.minStartUs,18000);assert.equal(DHT_PROFILES.dht22.minStartUs,1000);
 assert.deepEqual(dhtBytes('dht11',25.4,50.4),[50,0,25,0,75]);assert.deepEqual(dhtBytes('dht22',25,50),[1,244,0,250,239]);assert.deepEqual(dhtBytes('dht22',-12.3,67.8),[2,166,128,123,163]);
});
test('four examples on three boards preserve exact profiles, pull-ups, NC and compiled artifacts through ZIP',async()=>{
 for(const key of keys)for(const board of [S3,UNO,NANO]as const){const p=board===S3?newProject(dhtExamples[key].code,dhtExamples[key].title):arduinoExampleProject(key,board);p.circuit=dhtCircuit(key,board);assert.deepEqual(parseCircuit(p.circuit),p.circuit);assert.deepEqual(checkCircuit(p.circuit).diagnostics,[]);
  if(board===S3)p.files['dht.py']=driver;else{await validateArtifact(p,artifacts[board][key]);p.files[AVR_BUILD_FILE]=JSON.stringify(artifacts[board][key]);}
  assert.deepEqual(importProject(exportZip(p),'dht.zip'),parseProject(p));
 }
 const c=dhtCircuit('dht22');c.components[1].properties.temperature=81;assert.throws(()=>parseCircuit(c));c.components[1].properties.temperature=25;(c.components[1].properties as any).dhtFault='invented';assert.throws(()=>parseCircuit(c));
});
test('electrical model emits 40 MSB-first bits through real low/high voltages',()=>{
 const f=fixture();try{f.at(2100);const token=start(f.h);assert.equal(f.h.read(4,1),1);assert.deepEqual(decode(f.h),[1,244,0,250,239]);f.h.timingEnd(token);const s=f.frame().timedSensors.dht1;assert.equal(s.trace.length,84);assert.equal(s.bytes.length,5);assert(s.trace.some((v:any)=>v.durationUs===27));assert(s.trace.some((v:any)=>v.durationUs===70));}finally{f.h.dispose();}
});
test('startup, short start and different repeat intervals reject early requests',()=>{
 for(const key of ['dht11','dht22']as const){const f=fixture(key);try{let token=start(f.h);assert.equal(f.h.timePulseUs(4,0,1000),-2);f.h.timingEnd(token);assert.equal(f.frame().timedSensors.dht1.sample,0);
  f.at(2100);token=start(f.h,4,500);assert.equal(f.h.timePulseUs(4,0,1000),-2);f.h.timingEnd(token);
  f.at(2200);token=start(f.h);decode(f.h);f.h.timingEnd(token);
  f.at(3300);token=start(f.h);const pulse=f.h.timePulseUs(4,0,1000);assert(key==='dht11'?pulse>0:pulse===-2);f.h.timingEnd(token);
 }finally{f.h.dispose();}}
});
test('missing supply, ground, DATA and external pull-up do not deliver a measurement',()=>{
 for(const pin of ['VCC','GND','DATA','pull']){const f=fixture('dht22',c=>{if(pin==='pull'){remove(c,'pull0','1');remove(c,'pull0','2');}else remove(c,'dht1',pin);});try{f.at(2100);const token=start(f.h);const pulse=f.h.timePulseUs(4,0,1000);assert(pulse<0);f.h.timingEnd(token);assert.equal(f.frame().timedSensors.dht1.sample,0);}finally{f.h.dispose();}}
});
test('5 V ESP32 DATA domain, Nano ADC-only pin, tied DHTs and NC are diagnosed',()=>{
 const c=dhtCircuit('dht22');c.wires.find(w=>w.to.pin==='VCC')!.from.pin='J1.21';assert.throws(()=>compileCircuit(c),/5 V/);
 const nano=dhtCircuit('dht22',NANO);nano.wires.find(w=>w.to.pin==='DATA'&&w.from.component==='board')!.from.pin='A6';assert(checkCircuit(nano).diagnostics.some(d=>d.code==='dht-pin'));
 const pair=dhtCircuit('dhtCompare');pair.wires.push({id:'tie',from:{component:'dht1',pin:'DATA'},to:{component:'dht2',pin:'DATA'},color:'#087f8c',points:[]});assert(checkCircuit(pair).diagnostics.some(d=>d.code==='dht-collision'));
 const f=fixture('dhtCompare',c=>{c.wires.push({id:'tie',from:{component:'dht1',pin:'DATA'},to:{component:'dht2',pin:'DATA'},color:'#087f8c',points:[]});});try{f.at(2100);const token=start(f.h);assert.equal(f.h.timePulseUs(4,0,1000),-2);f.h.timingEnd(token);}finally{f.h.dispose();}
});
test('frame latches its environment, fault injection modifies bytes and separate GPIOs remain independent',()=>{
 const f=fixture('dhtCompare');try{f.at(2100);let token=start(f.h);f.h.input({component:'dht1',temperature:40});assert.deepEqual(decode(f.h),[50,0,25,0,75]);f.h.timingEnd(token);
  f.h.input({component:'dht2',temperature:-12.3,humidity:67.8,dhtFault:'checksum'});token=start(f.h,5);assert.deepEqual(decode(f.h,5),[2,166,128,123,162]);f.h.timingEnd(token);
  f.at(4500);f.h.input({component:'dht2',dhtFault:'timeout'});token=start(f.h,5);assert.equal(f.h.timePulseUs(5,0,1000),-2);f.h.timingEnd(token);
 }finally{f.h.dispose();}
});
test('virtual microsecond sleep/ticks and time_pulse_us timeout outcomes are precise',async()=>{
 const r=await done('dht22',`from machine import Pin,disable_irq,enable_irq,time_pulse_us\nfrom time import ticks_us,ticks_diff,sleep_us\np=Pin(10,Pin.IN,Pin.PULL_UP)\nstate=disable_irq()\nt=ticks_us()\nsleep_us(27)\nassert ticks_diff(ticks_us(),t)==28\nstart=ticks_us()\nwhile ticks_diff(ticks_us(),start)<20:\n pass\nassert time_pulse_us(p,0,100)==-2\nassert time_pulse_us(p,1,100)==-1\nenable_irq(state)\nprint('MICROSECONDS_OK')`);assert(r.text.includes('MICROSECONDS_OK'));
});
for(const kind of ['dht11','dht22']as const)test(`real MicroPython upstream driver decodes ${kind} and rejects checksum corruption`,async()=>{
 const code=pyPrelude+`sleep_ms(2100)\ns=${kind.toUpperCase()}(Pin(4))\ns.measure()\nassert s.temperature()==25 and s.humidity()==50\nprint('DECODED',list(s.buf))`;
 const r=await done(kind,code);assert(r.text.includes('DECODED'));
 const c=dhtCircuit(kind);c.components[1].properties.dhtFault='checksum';const bad=await done(kind,code,c,false);assert(bad.events.some((e:any)=>e.message?.includes('checksum error')));
});
test('real MicroPython negative values, live input, timeout, throttle and recovery',async()=>{
 const code=pyPrelude+`sleep_ms(2100)\ns=DHT22(Pin(4))\ns.measure()\nprint('FIRST')\nsleep_ms(100)\ntry:\n s.measure()\n raise AssertionError('too fast accepted')\nexcept OSError:\n print('THROTTLED')\nsleep_ms(2100)\ns.measure()\nassert abs(s.temperature()+12.3)<.01 and abs(s.humidity()-67.8)<.01\nprint('LIVE_NEGATIVE_OK')`;
 const s=python('dht22',code);try{await s.wait((v:Session)=>v.text.includes('FIRST'));s.input({component:'dht1',temperature:-12.3,humidity:67.8});await s.wait((v:Session)=>['done','error'].includes(v.status),10000);assert.equal(s.status,'done',s.text+JSON.stringify(s.events.filter((e:any)=>e.type==='error')));assert(s.text.includes('THROTTLED'));assert(s.text.includes('LIVE_NEGATIVE_OK'));}finally{await s.stop();}
 const c=dhtCircuit('dht22');c.components[1].properties.dhtFault='timeout';const r=await done('dht22',pyPrelude+'sleep_ms(2100)\nDHT22(Pin(4)).measure()',c,false);assert(r.events.some((e:any)=>e.message?.includes('OSError')));
});
test('real MicroPython two DHT sensors decode distinct payloads and forced Stop remains prompt',async()=>{
 const c=dhtCircuit('dhtCompare');c.components.find(p=>p.id==='dht2')!.properties.temperature=-12.3;
 const r=await done('dhtCompare',pyPrelude+`sleep_ms(2100)\na=DHT11(Pin(4));b=DHT22(Pin(5))\na.measure();b.measure()\nassert a.temperature()==25\nassert abs(b.temperature()+12.3)<.01\nprint('TWO_GPIO_OK')`,c);assert(r.text.includes('TWO_GPIO_OK'));
 const s=python('dhtErrors',dhtExamples.dhtErrors.code);await s.wait((v:Session)=>v.text.includes('DHT22 T='));const t=performance.now();await s.stop();assert(performance.now()-t<500);assert.equal(s.stopped,true);
});
for(const board of [UNO,NANO]as const)for(const key of keys)test(`actual AVR ${board} ${key}: Adafruit 1.4.6 pulse decoder`,async()=>{
 const p=arduinoExampleProject(key,board);await validateArtifact(p,artifacts[board][key]);const f=avr(key,board,c=>{if(key==='dht22')c.components[1].properties.temperature=-12.3;});try{advance(f.e,key==='dht11'?1350:2450);const out=text(f.events);assert(key==='dht22'?out.includes('T=-12.3'):out.includes(key==='dhtCompare'?'DHT11 T=25.0':'T=25.0'),out);
  if(key==='dhtCompare')assert(out.includes('DHT22 T=25.0'));
  if(key==='dhtErrors'){advance(f.e,600);assert(text(f.events).includes('nevaljano'));}
  assert(frames(f.events).at(-1).timedSensors.dht1.sample>=1);
 }finally{f.e.dispose();}
});
test('actual AVR corrupt checksum, no response and missing external pull-up produce NaN path',()=>{
 for(const fault of ['checksum','timeout','pull']as const){const f=avr('dht22',UNO,c=>{if(fault==='pull'){remove(c,'pull0','1');remove(c,'pull0','2');}else c.components[1].properties.dhtFault=fault;});try{advance(f.e,2400);assert(text(f.events).includes('nevaljano'),text(f.events));assert(!text(f.events).includes('T='));}finally{f.e.dispose();}}
});
test('actual AVR library caches results; live change arrives after its two-second interval',()=>{
 const f=avr('dht22',NANO);try{advance(f.e,2400);assert(text(f.events).includes('T=25.0'));f.e.input({component:'dht1',temperature:40,humidity:70});advance(f.e,2150);assert(text(f.events).includes('T=40.0 C RH=70.0'),text(f.events));}finally{f.e.dispose();}
});

test('actual AVR explicitly demonstrates cached data versus a forced transaction and recovery',async()=>{
 const f=JSON.parse(readFileSync('verification/stage12a-fixtures.json','utf8')).cacheForce;await validateArtifact(f.project,f.artifact);
 const events:any[]=[],e=new AVREngine(f.artifact.hex,compileCircuit(f.project.circuit,'avr'),v=>events.push(v),6,f.artifact.staticRamBytes);
 try{advance(e,2250);assert(text(events).includes('FIRST=25.0'));e.input({component:'dht1',temperature:40});advance(e,350);assert(text(events).includes('CACHED=25.0'));advance(e,400);assert(text(events).includes('FORCED=0'));advance(e,2200);assert(text(events).includes('RECOVER=40.0'),text(events));assert.equal(frames(events).at(-1).timedSensors.dht1.sample,2);}finally{e.dispose();}
});
test('active HIGH against the open-drain DATA response is diagnosed as an output conflict',()=>{
 const f=fixture();try{f.at(2100);const token=start(f.h);f.h.mode(4,1,0,1);f.h.delayUs(30);assert.equal(f.h.read(4),-2);f.h.timingEnd(token);assert(f.frame().diagnostics.some((d:any)=>d.code==='dht-output-conflict'));}finally{f.h.dispose();}
});
test('production Nano Worker decodes DHT live data, terminates and resets with fresh inputs',async()=>{
 const {pathToFileURL}=await import('node:url'),{resolve}=await import('node:path');
 const manifest=JSON.parse(readFileSync('dist/offline-package.json','utf8')),asset=manifest.files.find((f:any)=>/^\/assets\/avrWorker-.*\.js$/.test(f.url));assert(asset);
 assert(manifest.files.some((f:any)=>f.url===`/app/${manifest.build}/dht-bus.mjs`));assert(manifest.files.some((f:any)=>f.url===`/app/${manifest.build}/drivers/dht.py`));
 const a=artifacts[NANO].dht22,p=arduinoExampleProject('dht22',NANO),circuit=compileCircuit(p.circuit as Circuit,'avr');
 const run=()=>{const events:any[]=[],worker=new Worker(new URL('./avr-built-worker.mjs',import.meta.url),{workerData:{path:pathToFileURL(resolve('dist'+asset.url)).href}});let error:Error|undefined;worker.on('message',e=>events.push(e));worker.on('error',e=>error=e);worker.postMessage({type:'run',session:21,hex:a.hex,circuit,adcChannels:8,staticRamBytes:a.staticRamBytes});return {worker,events,error:()=>error};};
 async function wait(f:ReturnType<typeof run>,predicate:()=>boolean){const start=performance.now();while(!predicate()){if(f.error())throw f.error();assert(!f.events.some(e=>e.type==='error'),JSON.stringify(f.events.filter(e=>e.type==='error')));if(performance.now()-start>10000)throw Error('Production DHT Worker timeout: '+text(f.events));await new Promise(r=>setTimeout(r,10));}}
 const f=run();try{await wait(f,()=>text(f.events).includes('T=25.0'));f.worker.postMessage({type:'input',session:21,component:'dht1',temperature:-12.3,humidity:67.8});await wait(f,()=>text(f.events).includes('T=-12.3 C RH=67.8'));const start=performance.now();await f.worker.terminate();assert(performance.now()-start<500);}finally{await f.worker.terminate();}
 const fresh=run();try{await wait(fresh,()=>text(fresh.events).includes('T=25.0'));assert(!text(fresh.events).includes('T=-12.3'));}finally{await fresh.worker.terminate();}
});
