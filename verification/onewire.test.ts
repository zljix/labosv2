import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Worker} from 'node:worker_threads';
import {createCircuitHost} from '../public/circuit-host.mjs';
import {crc8,makeROM,validROM,temperatureBytes,conversionUs} from '../public/onewire-bus.mjs';
import {oneWireCircuit,oneWireExamples,oneWireDriverNames,type OneWireExample} from '../src/circuit/oneWireExamples';
import {compileCircuit} from '../src/circuit/compile';
import {parseCircuit,terminals,type Circuit} from '../src/circuit/model';
import {checkCircuit} from '../src/circuit/netlist';
import {S3,UNO,NANO,type BoardId} from '../src/boards/profiles';
import {newProject,parseProject} from '../src/project/model';
import {exportZip,importProject} from '../src/project/archive';
import {arduinoExampleProject} from '../src/runtime/arduinoExamples';
import {AVREngine} from '../src/runtime/avrEngine';
import {validateArtifact,AVR_BUILD_FILE,libraryManifest} from '../public/avr-contract.mjs';
import {Session} from '../dist/session.mjs';
const machine=readFileSync('public/machine.py','utf8'),drivers=Object.fromEntries(oneWireDriverNames.map(n=>[n,readFileSync('public/drivers/'+n,'utf8')]));
const artifacts=JSON.parse(readFileSync('public/avr-examples.json','utf8'));
const keys=Object.keys(oneWireExamples) as OneWireExample[];
const text=(events:any[])=>events.filter(e=>e.type==='console').map(e=>e.text).join('');
const frames=(events:any[])=>events.filter(e=>e.type==='simulation');
const remove=(c:Circuit,id:string,pin:string)=>{c.wires=c.wires.filter(w=>![w.from,w.to].some(e=>e.component===id&&e.pin===pin));};
function fixture(key:OneWireExample='ds18b20',edit=(c:Circuit)=>{}){
 const c=oneWireCircuit(key);edit(c);let time=0;const events:any[]=[];
 const h=createCircuitHost((e:any)=>events.push(e),{circuit:compileCircuit(c),manualPublish:true,nowMs:()=>time});
 const token=h.timingBegin();
 const low=()=>h.mode(4,1,0,0),release=()=>h.mode(4,0,1);
 const reset=(duration=480)=>{release();h.delayUs(10);low();h.delayUs(duration);release();h.delayUs(70);const r=h.read(4,1)===0;h.delayUs(410);return r;};
 const wb=(v:number)=>{low();h.delayUs(v?10:65);release();h.delayUs(v?55:5);};
 const rb=()=>{low();h.delayUs(3);release();h.delayUs(10);const v=h.read(4,1);h.delayUs(53);return v;};
 const write=(v:number)=>{for(let i=0;i<8;i++)wb((v>>i)&1);};
 const read=()=>{let v=0;for(let i=0;i<8;i++)v|=rb()<<i;return v;};
 const select=(id='ds1')=>{assert(reset());write(0x55);for(const b of c.components.find(p=>p.id===id)!.properties.rom!.match(/../g)!)write(parseInt(b,16));};
 const scratch=(id='ds1')=>{select(id);write(0xbe);return Array.from({length:9},read);};
 return {c,h,reset,write,read,wb,rb,select,scratch,frame:()=>{h.flush();return frames(events).at(-1);},close:()=>{h.timingEnd(token);h.dispose();}};
}
const factory=()=>{const w=new Worker(new URL('./node-worker.mjs',import.meta.url)),shim:any={postMessage:(d:any)=>w.postMessage(d),terminate:()=>w.terminate()};w.on('message',d=>shim.onmessage?.({data:d}));w.on('error',e=>shim.onerror?.(e));return shim;};
function python(code:string,c=oneWireCircuit('ds18b20')){return new Session(factory,machine,code,{circuit:compileCircuit(c)},()=>{},drivers);}
async function done(code:string,c=oneWireCircuit('ds18b20'),ok=true){const s=python(code,c);try{await s.wait((v:Session)=>['done','error'].includes(v.status),12000);assert.equal(s.status,ok?'done':'error',s.text+JSON.stringify(s.events.filter((e:any)=>e.type==='error')));return {text:s.text,events:s.events};}finally{await s.stop();}}
const prelude='from machine import Pin\nfrom time import sleep_ms\nfrom onewire import OneWire\nfrom ds18x20 import DS18X20\nbus=OneWire(Pin(4))\ns=DS18X20(bus)\nroms=s.scan()\n';
function avr(key:OneWireExample,board:typeof UNO|typeof NANO,edit=(c:Circuit)=>{}){const p=arduinoExampleProject(key,board),a=artifacts[board][key];edit(p.circuit as Circuit);const events:any[]=[];const e=new AVREngine(a.hex,compileCircuit(p.circuit as Circuit,'avr'),v=>events.push(v),board===NANO?8:6,a.staticRamBytes);return {p,a,e,events};}
function advance(e:AVREngine,ms:number){for(let n=0;n<ms;n+=10){e.runCycles(160000);e.frame();}}

test('known DS18B20 scratchpad CRC, signed temperature words and conversion limits',()=>{
 assert.equal(crc8([0x50,5,75,70,0x7f,0xff,0x0c,0x10]),0x1c);
 assert.deepEqual(temperatureBytes(-55),[0x90,0xfc]);assert.deepEqual(temperatureBytes(125),[0xd0,7]);assert.deepEqual(temperatureBytes(-10.125),[0x5e,0xff]);
 assert.deepEqual([9,10,11,12].map(conversionUs),[93750,187500,375000,750000]);
 assert(validROM(makeROM('a')));assert.notEqual(makeROM('a'),makeROM('b'));assert(!validROM('2800000000000001'));assert(!validROM('1000000000000000'));
});
test('four examples on all supported boards preserve ROM, drivers, artifact and ZIP/JSON',async()=>{
 for(const key of keys)for(const board of [S3,UNO,NANO]as const){const p=board===S3?newProject(oneWireExamples[key].code,oneWireExamples[key].title):arduinoExampleProject(key,board);p.circuit=oneWireCircuit(key,board);assert.deepEqual(checkCircuit(p.circuit).diagnostics,[]);assert.deepEqual(parseCircuit(p.circuit),p.circuit);
  if(board===S3)Object.assign(p.files,drivers);else{await validateArtifact(p,artifacts[board][key]);p.files[AVR_BUILD_FILE]=JSON.stringify(artifacts[board][key]);}
  assert.deepEqual(importProject(exportZip(p),'ds18.zip'),parseProject(p));
 }
 const c=oneWireCircuit('ds18b20');c.components[1].properties.rom='2800000000000001';assert.throws(()=>parseCircuit(c));
 assert.throws(()=>libraryManifest([{name:'DallasTemperature',version:'4.0.6'}]),/OneWire/);
});
test('reset/presence uses real network LOW; Read ROM sends LSB first',()=>{
 const f=fixture();try{assert(f.reset());f.write(0x33);const rom=Array.from({length:8},f.read);assert.equal(rom.map(v=>v.toString(16).padStart(2,'0')).join('').toUpperCase(),f.c.components[1].properties.rom);assert.equal(crc8(rom),0);assert.equal(f.h.read(4,1),1);}finally{f.close();}
});
test('scratchpad starts at 85 C and CRC alone does not establish freshness',()=>{
 const f=fixture();try{assert.deepEqual(f.scratch(),[80,5,75,70,127,255,12,16,28]);assert.equal(f.frame().oneWireDevices.ds1.sample,0);
  assert(f.reset());f.write(0xcc);f.write(0x44);assert.equal(f.rb(),0);assert.equal(f.scratch()[0],80);f.h.delayUs(750000);const b=f.scratch();assert.deepEqual(b.slice(0,2),[0x90,1]);assert.equal(crc8(b),0);assert.equal(f.frame().oneWireDevices.ds1.sample,1);
 }finally{f.close();}
});
test('Convert T latches environment, polls busy and only updates after its deadline',()=>{
 const f=fixture();try{f.select();f.write(0x44);f.h.input({component:'ds1',temperature:40});f.h.delayUs(740000);assert.equal(f.rb(),0);f.h.delayUs(10000);assert.equal(f.rb(),1);assert.deepEqual(f.scratch().slice(0,2),[0x90,1]);f.select();f.write(0x44);f.h.delayUs(750000);assert.deepEqual(f.scratch().slice(0,2),[0x80,2]);}finally{f.close();}
});
test('Write Scratchpad configures all four resolutions with known quantization and time',()=>{
 const f=fixture('ds18b20',c=>c.components[1].properties.temperature=25.4375);try{for(const [bits,raw]of [[9,400],[10,404],[11,406],[12,407]]){f.select();f.write(0x4e);for(const b of [75,70,((bits-9)<<5)|31])f.write(b);f.select();f.write(0x44);f.h.delayUs(conversionUs(bits)-1000);assert.equal(f.rb(),0);f.h.delayUs(1000);assert.equal(f.rb(),1);const b=f.scratch();assert.equal(b[0]|b[1]<<8,raw);assert.equal(crc8(b),0);}}finally{f.close();}
});
test('Match ROM reads separate scratchpads and Skip ROM read is wired AND',()=>{
 const f=fixture('ds18Multi');try{assert(f.reset());f.write(0xcc);f.write(0x44);f.h.delayUs(750000);const rows=['ds1','ds2','ds3'].map(f.scratch);assert.deepEqual(rows.map(b=>b[0]|b[1]<<8),[400,0xff5e,960]);assert(f.reset());f.write(0xcc);f.write(0xbe);const combined=Array.from({length:9},f.read);assert.deepEqual(combined,rows[0].map((v,i)=>v&rows[1][i]&rows[2][i]));}finally{f.close();}
});
test('CRC fault changes data on the wire and disconnected DQ loses presence',()=>{
 const f=fixture();try{f.h.input({component:'ds1',oneWireFault:'crc'});assert.notEqual(crc8(f.scratch()),0);f.h.input({component:'ds1',oneWireFault:'disconnected'});assert(!f.reset());f.h.input({component:'ds1',oneWireFault:'none'});assert(f.reset());assert.equal(crc8(f.scratch()),0);}finally{f.close();}
});
test('missing external pull-up, supply, ground and DQ cannot return valid data',()=>{
 for(const pin of ['VDD','GND','DQ','pull']){const f=fixture('ds18b20',c=>remove(c,pin==='pull'?'owPull':'ds1',pin==='pull'?'1':pin));try{assert(!f.reset(),pin);assert.equal(f.frame().oneWireDevices.ds1.sample,0);}finally{f.close();}}
});
test('wrong voltage domain, duplicate ROM, ADC-only Nano and short reset are diagnosed',()=>{
 const c=oneWireCircuit('ds18Multi');c.components[2].properties.rom=c.components[1].properties.rom;assert.throws(()=>compileCircuit(c),/jedinstven ROM/);
 const bad=oneWireCircuit('ds18b20');bad.wires.find(w=>w.to.pin==='VDD')!.from.pin='J1.21';assert.throws(()=>compileCircuit(bad),/5 V/);
 const nano=oneWireCircuit('ds18b20',NANO);nano.wires.find(w=>w.to.pin==='DQ'&&w.from.component==='board')!.from.pin='A6';assert(checkCircuit(nano).diagnostics.some(d=>d.code==='onewire-pin'));
 const f=fixture();try{assert(!f.reset(400));assert(f.reset());}finally{f.close();}
});
test('active GPIO HIGH against a 1-Wire LOW produces an output conflict',()=>{
 const f=fixture();try{assert(f.reset());f.write(0x33);f.h.mode(4,1,0,0);f.h.delayUs(3);f.h.mode(4,1,0,1);f.h.delayUs(10);assert.equal(f.h.read(4),-2);assert(f.frame().diagnostics.some((d:any)=>d.code==='onewire-output-conflict'));}finally{f.close();}
});
test('Copy and Recall Scratchpad preserve the three configuration bytes',()=>{
 const f=fixture();try{f.select();f.write(0x4e);[0x55,0x11,0x1f].forEach(f.write);f.select();f.write(0x48);assert.equal(f.rb(),0);f.h.delayUs(10000);assert.equal(f.rb(),1);f.select();f.write(0x4e);[75,70,0x7f].forEach(f.write);f.select();f.write(0xb8);assert.deepEqual(f.scratch().slice(2,5),[0x55,0x11,0x1f]);}finally{f.close();}
});
test('power cycle restores EEPROM and 85 C, and cancels an unfinished copy or conversion',()=>{
 const f=fixture('ds18b20',c=>{c.wires.find(w=>w.to.pin==='VDD')!.from.pin=terminals(c.components[0]).find(t=>t.gpio===6)!.pin;});try{
  f.h.mode(6,1,0,1);f.select();f.write(0x4e);[0x55,0x11,0x1f].forEach(f.write);f.select();f.write(0x48);f.h.delayUs(10000);f.scratch();
  f.select();f.write(0x4e);[75,70,0x7f].forEach(f.write);f.select();f.write(0x48);f.h.delayUs(1000);f.h.mode(6,1,0,0);f.h.delayUs(20000);f.h.mode(6,1,0,1);
  assert.deepEqual(f.scratch().slice(2,5),[0x55,0x11,0x1f]);f.select();f.write(0x44);f.h.delayUs(1000);f.h.mode(6,1,0,0);f.h.delayUs(1000000);f.h.mode(6,1,0,1);assert.deepEqual(f.scratch().slice(0,2),[80,5]);assert.equal(f.frame().oneWireDevices.ds1.sample,0);
 }finally{f.close();}
});
test('wrong Match ROM gives no selected sensor and Read Power Supply reports external VDD',()=>{
 const f=fixture();try{assert(f.reset());f.write(0x55);for(let i=0;i<8;i++)f.write(0);f.write(0xbe);assert.deepEqual(Array.from({length:9},f.read),Array(9).fill(255));assert(f.reset());f.write(0xcc);f.write(0xb4);assert.equal(f.rb(),1);}finally{f.close();}
});
test('real upstream MicroPython search finds all ROMs, initial 85 and separate signed values',async()=>{
 const r=await done(prelude+`assert len(roms)==3\nassert all(bus.crc8(r)==0 for r in roms)\nassert [s.read_temp(r) for r in roms]==[85,85,85]\ns.convert_temp()\nsleep_ms(750)\nassert sorted(s.read_temp(r) for r in roms)==[-10.125,25,60]\nprint('MULTIDROP_OK')`,oneWireCircuit('ds18Multi'));assert(r.text.includes('MULTIDROP_OK'));
});
test('real upstream MicroPython CRC error and missing presence are explicit failures',async()=>{
 const c=oneWireCircuit('ds18b20');c.components[1].properties.oneWireFault='crc';let r=await done(prelude+'s.read_temp(roms[0])',c,false);assert(r.events.some((e:any)=>e.message?.includes('CRC error')));
 c.components[1].properties.oneWireFault='disconnected';r=await done(prelude+"assert not roms\ns.convert_temp()",c,false);assert(r.events.some((e:any)=>e.type==='error'));
});
test('real upstream Alarm Search selects sensors outside configured integer thresholds',async()=>{
 const r=await done(prelude+`assert len(roms)==3\nfor rom in roms:\n s.write_scratch(rom,bytes((50,0,127)))\ns.convert_temp()\nsleep_ms(750)\nbus.SEARCH_ROM=0xEC\nalarm=bus.scan()\nassert len(alarm)==2\nassert sorted(s.read_temp(r) for r in alarm)==[-10.125,60]\nprint('ALARMS_OK')`,oneWireCircuit('ds18Multi'));assert(r.text.includes('ALARMS_OK'));
});
test('real MicroPython OPEN_DRAIN releases HIGH and original Pin OUT still follows its latch',async()=>{
 const r=await done(`from machine import Pin\np=Pin(4,Pin.OPEN_DRAIN,Pin.PULL_UP,value=1)\nassert p()==1\np(0)\nassert p()==0\np(1)\nassert p()==1\nq=Pin(6,Pin.OUT,value=0)\nq.on()\nq.init(Pin.OUT)\nassert q()==1\nprint('OPEN_DRAIN_OK')`);assert(r.text.includes('OPEN_DRAIN_OK'));
});
test('real MicroPython live input, latched conversion and Stop/Reset',async()=>{
 const code=prelude+`s.convert_temp()\nprint('STARTED')\nsleep_ms(750)\nassert s.read_temp(roms[0])==25\ns.convert_temp()\nsleep_ms(750)\nassert s.read_temp(roms[0])==-55\nprint('LIVE_OK')\nwhile True: sleep_ms(100)`;
 const s=python(code);try{await s.wait((v:Session)=>v.text.includes('STARTED'));s.input({component:'ds1',temperature:-55});await s.wait((v:Session)=>v.text.includes('LIVE_OK')||v.status==='error',10000);assert(s.text.includes('LIVE_OK'),s.text+JSON.stringify(s.events.filter((e:any)=>e.type==='error')));const at=performance.now();await s.stop();assert(performance.now()-at<500);}finally{await s.stop();}
 const fresh=await done(prelude+"assert s.read_temp(roms[0])==85\nprint('RESET_OK')");assert(fresh.text.includes('RESET_OK'));
});
for(const board of [UNO,NANO]as const)for(const key of keys)test(`actual AVR ${board} ${key}: unmodified OneWire and DallasTemperature`,async()=>{
 const f=avr(key,board);try{await validateArtifact(f.p,f.a);advance(f.e,key==='ds18Resolution'?2100:1500);const out=text(f.events);assert(out.includes('T=25.0000'),out);if(key==='ds18Multi'){assert(out.includes('T=-10.1250'),out);assert(out.includes('T=60.0000'),out);}if(key==='ds18Errors'){assert(out.includes('T=85.0000'),out);assert(out.includes('NAKON CEKANJA:'),out);}if(key==='ds18Resolution')for(let b=9;b<=12;b++)assert(out.includes('BITA='+b),out);}finally{f.e.dispose();}
});
test('actual AVR CRC corruption and disconnected signal choose error paths then recover',()=>{
 const f=avr('ds18b20',UNO);try{advance(f.e,1500);assert(text(f.events).includes('T=25.0000'));f.e.input({component:'ds1',oneWireFault:'crc'});advance(f.e,2000);assert(text(f.events).includes('nevaljano / CRC'));f.e.input({component:'ds1',oneWireFault:'disconnected'});advance(f.e,2000);assert(text(f.events).includes('nema valjanog ROM-a'));f.e.input({component:'ds1',oneWireFault:'none',temperature:125});advance(f.e,2200);assert(text(f.events).includes('T=125.0000'),text(f.events));}finally{f.e.dispose();}
});
test('actual AVR raw ROM search and CRC fixture enumerates all three identities',async()=>{
 const {project,artifact}=JSON.parse(readFileSync('verification/stage12b-fixtures.json','utf8')).protocol;await validateArtifact(project,artifact);const events:any[]=[],e=new AVREngine(artifact.hex,compileCircuit(project.circuit,'avr'),v=>events.push(v),6,artifact.staticRamBytes);try{advance(e,1600);const out=text(events);assert(out.includes('RESET=1'),out);assert(out.includes('COUNT=3'),out);assert(out.includes('DALLAS=3'),out);for(const v of ['-10.1250','25.0000','60.0000'])assert(out.includes('T='+v),out);assert(!out.includes('-127.'),out);assert(out.includes('DONE'));}finally{e.dispose();}
});
test('production Nano Worker reads 1-Wire live data and resets after termination',async()=>{
 const {pathToFileURL}=await import('node:url'),{resolve}=await import('node:path');
 const manifest=JSON.parse(readFileSync('dist/offline-package.json','utf8')),asset=manifest.files.find((f:any)=>/^\/assets\/avrWorker-.*\.js$/.test(f.url));assert(asset);
 for(const suffix of ['onewire-bus.mjs','drivers/onewire.py','drivers/ds18x20.py','drivers/_onewire.py'])assert(manifest.files.some((f:any)=>f.url===`/app/${manifest.build}/${suffix}`));
 const a=artifacts[NANO].ds18b20,p=arduinoExampleProject('ds18b20',NANO),circuit=compileCircuit(p.circuit as Circuit,'avr');
 const run=()=>{const events:any[]=[],worker=new Worker(new URL('./avr-built-worker.mjs',import.meta.url),{workerData:{path:pathToFileURL(resolve('dist'+asset.url)).href}});let error:Error|undefined;worker.on('message',e=>events.push(e));worker.on('error',e=>error=e);worker.postMessage({type:'run',session:31,hex:a.hex,circuit,adcChannels:8,staticRamBytes:a.staticRamBytes});return {worker,events,error:()=>error};};
 async function wait(f:ReturnType<typeof run>,predicate:()=>boolean){const start=performance.now();while(!predicate()){if(f.error())throw f.error();assert(!f.events.some(e=>e.type==='error'),JSON.stringify(f.events.filter(e=>e.type==='error')));if(performance.now()-start>25000)throw Error('Production 1-Wire Worker timeout: '+text(f.events));await new Promise(r=>setTimeout(r,20));}}
 const f=run();try{await wait(f,()=>text(f.events).includes('T=25.0000'));f.worker.postMessage({type:'input',session:31,component:'ds1',temperature:-55});await wait(f,()=>text(f.events).includes('T=-55.0000'));const at=performance.now();await f.worker.terminate();assert(performance.now()-at<500);}finally{await f.worker.terminate();}
 const fresh=run();try{await wait(fresh,()=>text(fresh.events).includes('T=25.0000'));assert(!text(fresh.events).includes('T=-55.0000'));}finally{await fresh.worker.terminate();}
});
