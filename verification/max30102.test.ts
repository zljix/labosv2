import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {Worker} from 'node:worker_threads';
import {MAX30102,OPTICAL_DEFAULTS,OPTICAL_RANGES} from '../public/max30102.mjs';
import {createCircuitHost} from '../public/circuit-host.mjs';
import {opticalCircuit,opticalExamples,type OpticalExample} from '../src/circuit/max30102Examples';
import {cppMAX30102} from '../src/circuit/max30102Driver';
import {compileCircuit,type SimulationFrame} from '../src/circuit/compile';
import {parseCircuit,type Circuit} from '../src/circuit/model';
import {checkCircuit} from '../src/circuit/netlist';
import {S3,UNO,NANO} from '../src/boards/profiles';
import {newProject,parseProject} from '../src/project/model';
import {exportZip,importProject} from '../src/project/archive';
import {arduinoExampleProject} from '../src/runtime/arduinoExamples';
import {s3ExampleProject} from '../src/runtime/s3Examples';
import {validateArtifact as validateAVR} from '../public/avr-contract.mjs';
import {validateArtifact as validateS3,wasmBytes} from '../public/s3-contract.mjs';
import {AVREngine} from '../src/runtime/avrEngine';
import {createS3Engine} from '../public/s3-engine.mjs';
import {Session} from '../public/session.mjs';
const dir='docs/stage20-evidence';mkdirSync(dir,{recursive:true});
const save=(n:string,v:any)=>writeFileSync(dir+'/'+n+'.json',JSON.stringify(v,null,2)+'\n');
const last=(es:any[])=>es.filter(e=>e.type==='simulation').at(-1) as SimulationFrame;
const output=(es:any[])=>es.filter(e=>e.type==='console').map(e=>e.text).join('');
const keys=Object.keys(opticalExamples) as OpticalExample[];
const words=(b:Uint8Array)=>Array.from({length:b.length/3},(_,i)=>(b[i*3]<<16)|(b[i*3+1]<<8)|b[i*3+2]);
function model(){
 let now=0;const d:any=new MAX30102({...OPTICAL_DEFAULTS},()=>now);
 const put=(r:number,v:number)=>{d.onAddress(true);d.write(Uint8Array.of(r,v));d.end(true);};
 const get=(r:number,n=1)=>{d.onAddress(true);d.write(Uint8Array.of(r));d.end(true);d.onAddress(false);const b=d.read(n);d.end(false);return b;};
 const config=(mode=3,ave=0,pw=3)=>{put(8,ave<<5);put(10,0x24|pw);put(12,31);put(13,31);put(9,mode);};
 return {d,get,put,config,at:(n:number)=>{now=n;d.update();},advance:(n:number)=>{now+=n;d.update();}};
}
test('24L telemetry keeps completed register/FIFO transfers, rejects failed reads and bounds the ledger',()=>{
 const f=model();f.config();f.get(255);f.at(30);
 f.d.onAddress(true);f.d.write(Uint8Array.of(7));f.d.end(true);f.d.onAddress(false);
 f.d.read(5);f.d.end(false,false);assert.equal(f.d.history.length,0);
 assert(!f.d.snapshot(true).transfers.some((t:any)=>t.register===7));
 f.get(7,6);assert.equal(f.d.history.length,1);
 const t=f.d.snapshot(true).transfers.find((t:any)=>t.register===7)!;
 assert.equal(t.operation,'read');assert.equal(t.length,6);assert.deepEqual(words(Uint8Array.from(t.bytes)),[f.d.last.red,f.d.last.ir]);
 assert.equal(t.transaction,f.d.last.transaction);
 f.d.onAddress(true);f.d.write(Uint8Array.of(7));f.d.end(true);f.d.onAddress(false);f.d.read(6);f.d.end(false,false);
 assert(!f.d.snapshot(true).transfers.some((t:any)=>t.transaction===f.d.last.transaction));
 const sequence=t.sequence;f.put(9,64);f.advance(1);assert(f.d.snapshot(true).transfers.some((t:any)=>t.sequence===sequence));
 for(let i=0;i<100;i++)f.get(255);const ledger=f.d.snapshot(true).transfers;
 assert.equal(ledger.length,64);assert(ledger.every((t:any,i:number)=>!i||t.sequence>ledger[i-1].sequence));
 f.d.reset(true);assert.equal(f.d.snapshot(true).transfers.length,0);
});
test('datasheet identity, reset pulse, read-only registers and explicit unsupported features',()=>{
 const f=model();assert.equal(f.get(255)[0],0x15);assert.equal(f.get(0)[0],1);assert.equal(f.get(0)[0],0);assert.deepEqual([...f.get(254,3)],[3,21,21]);
 for(const [r,v]of [[255,0],[9,7],[8,16],[0x11,0x21],[0x21,1],[3,2]])assert.throws(()=>f.put(r,v),/MAX30102/);
 f.put(9,64);assert.equal(f.get(9)[0],64);f.at(.999);assert.equal(f.get(9)[0],64);f.at(1);assert.equal(f.get(9)[0],0);
});
test('first independent known RED/IR words, six-byte burst and no FIFO auto-increment',()=>{
 const f=model();f.config();f.at(9.999);assert.equal(f.d.count,0);f.at(10);assert.equal(f.d.count,1);
 assert.deepEqual(words(f.get(7,6)),[68000,80000]);assert.equal(f.d.pointer,7);assert.equal(f.d.count,0);assert.equal(f.get(6)[0],1);assert.equal(f.d.history.length,1);
 assert.deepEqual([...f.get(7,6)],[0,0,0,0,0,0]);assert.equal(f.d.history.length,1);
});
test('RD advances on FIRST byte, interrupted sample is discarded, rewinding RD re-reads bank data',()=>{
 const f=model();f.config();f.at(30);f.d.onAddress(true);f.d.write(Uint8Array.of(7));f.d.end(true);f.d.onAddress(false);assert.equal(f.d.readByte(),1);assert.equal(f.d.reg[6],1);assert.equal(f.d.count,2);assert.equal(f.d.history.length,0);f.d.end(false);
 f.put(6,0);assert.deepEqual(words(f.get(7,6)),[68000,80000]);assert.equal(f.d.reg[6],1);assert.equal(f.d.history.length,1);
});
test('all four ADC resolutions are left-justified; RED mode uses three bytes and IR PA=0 gates IR',()=>{
 for(let pw=0;pw<4;pw++){const f=model();f.config(2,0,pw);f.at(10);const value=words(f.get(7,3))[0];assert.equal(value,68000&~((1<<(3-pw))-1));assert.equal(f.d.history[0].ir,null);assert.equal(f.d.reg[6],1);}
 const f=model();f.config();f.put(13,0);f.at(10);assert.deepEqual(words(f.get(7,6)),[68000,0]);
});
test('per-channel average/decimation: no word before complete group, exact independently computed mean',()=>{
 const f=model();f.config(3,2);f.at(39.999);assert.equal(f.d.count,0);f.at(40);
 const expected=[0,1].map(ch=>Math.round(Array.from({length:4},(_,i)=>{const p=2*Math.PI*72/60/100*i,w=Math.sin(p)+.2*Math.sin(2*p);return ch?80000+6000*w:68000+4200*w;}).reduce((a,b)=>a+b)/4));
 assert.deepEqual(words(f.get(7,6)),expected);assert.equal(f.d.snapshot(true).effectiveRate,25);
});
test('full versus empty equal pointers, saturating overflow, pop clears overflow and read permits recovery',()=>{
 const f=model();f.config();f.at(700);assert.equal(f.d.count,32);assert.equal(f.d.reg[4],f.d.reg[6]);assert.equal(f.get(5)[0],31);assert.equal(f.get(0)[0]&128,128);assert.equal(f.get(0)[0],0);
 assert.deepEqual(words(f.get(7,6)),[68000,80000]);assert.equal(f.get(5)[0],0);assert.equal(f.d.count,31);f.advance(10);assert.equal(f.d.count,32);assert.equal(f.d.dropped,38);assert.equal(f.d.reg[4],1);
});
test('averaging group already in progress when full drops correctly; long stalled reader is bounded',()=>{
 const f=model();f.config(3,2);f.at(1290);assert.equal(f.d.count,32);f.at(1320);assert.equal(f.d.count,32);assert.equal(f.d.dropped,1);
 const start=performance.now();f.at(86400000);assert.equal(f.d.count,32);assert.equal(f.d.reg[5],31);assert(performance.now()-start<500);assert(f.d.dropped>2000000);
});
test('shutdown freezes sample acquisition, resume does not catch up and reset clears FIFO/history',()=>{
 const f=model();f.config();f.at(20);f.put(9,131);f.at(1000);assert.equal(f.d.sample,2);f.put(9,3);f.at(1009);assert.equal(f.d.sample,2);f.at(1010);assert.equal(f.d.sample,3);f.get(7,6);f.put(9,64);assert.equal(f.d.count,0);assert.equal(f.d.history.length,0);
});
test('physical sample-rate/pulse-width table is enforced for both supported modes',()=>{
 for(const [mode,cfg,ok]of [[3,0x27,true],[3,0x37,false],[3,0x38,true],[3,0x3c,false],[2,0x3c,true],[2,0x3d,false]] as const){const f=model();f.put(10,cfg);if(ok)f.put(9,mode);else assert.throws(()=>f.put(9,mode),/kombinacija/);}
});
test('live source change keeps old FIFO words and phase; no contact or zero amplitude gives no periodic waveform',()=>{
 const f=model();f.config();f.at(10);f.d.device.opticalContact=false;f.at(20);assert.deepEqual(words(f.get(7,12)),[68000,80000,425,500]);
 const z=model();z.d.device.opticalAmplitude=0;z.config();z.at(50);assert.equal(new Set(words(z.get(7,30))).size,2);
});
test('history stores only complete program reads and stays capped at 128',()=>{
 const f=model();f.config();for(let i=1;i<=200;i++){f.at(i*10);f.get(7,6);}assert.equal(f.d.history.length,128);assert.equal(f.d.history[0].index,73);assert.equal(f.d.history.at(-1).index,200);
});
for(const board of [S3,UNO,NANO] as const)test(board+': four optical circuits and source projects round-trip JSON/ZIP',()=>{
 for(const key of keys){const p=board===S3?newProject(opticalExamples[key].code,opticalExamples[key].title):arduinoExampleProject(key,board);p.circuit=opticalCircuit(key,board);assert.equal(checkCircuit(p.circuit).diagnostics.length,0);assert.deepEqual(parseCircuit(p.circuit),p.circuit);assert.deepEqual(importProject(exportZip(p),'max.zip'),parseProject(p));}
});
test('optical properties reject invalid/missing values; fixed address collides on same bus',()=>{
 for(const [key,[min,max]]of Object.entries(OPTICAL_RANGES))for(const bad of [NaN,min-1,max+1,'72',undefined]){const c=opticalCircuit();(c.components[1].properties as any)[key]=bad;assert.throws(()=>parseCircuit(c));}
 const c=opticalCircuit();c.components.push({...structuredClone(c.components[1]),id:'second'});c.wires.push(...c.wires.map(w=>({...w,id:w.id+'second',to:{...w.to,component:'second'}})));assert.throws(()=>compileCircuit(c),/adresu/);
 assert.equal(readFileSync('public/drivers/lab_max30102.h','utf8'),cppMAX30102);
});
test('electrical host routes address/ACK and rejects absent supply, ground, pullups and swapped lines',()=>{
 for(const fault of ['VCC','GND','SDA','SCL','pullups','swap','domain','none']){
  const c=opticalCircuit();if(fault==='pullups')c.components[1].properties.pullups=false;else if(fault==='domain')c.components[1].properties.moduleVoltage=5;else if(fault==='swap')for(const w of c.wires)if(['SDA','SCL'].includes(w.to.pin))w.to.pin=w.to.pin==='SDA'?'SCL':'SDA';else{}else if(fault!=='none')c.wires=c.wires.filter(w=>w.to.pin!==fault);
  let now=0;const events:any[]=[];const h=createCircuitHost((e:any)=>events.push(e),{circuit:compileCircuit(c),manualPublish:true,nowUs:()=>now});
  try{h.i2cConfig(0,8,9,100000);assert.equal(h.i2cProbe(0,0x57),fault==='none',fault);assert.equal(h.i2cProbe(0,0x58),false);h.flush();if(fault!=='none')assert.equal(last(events).optical!.optical1.readings.length,0);}finally{h.dispose();}
 }
});
const factory=()=>{const w=new Worker(new URL('./node-worker.mjs',import.meta.url));const shim:any={postMessage:(d:any)=>w.postMessage(d),terminate:()=>w.terminate()};w.on('message',data=>shim.onmessage?.({data}));w.on('error',error=>shim.onerror?.(error));return shim;};
function python(code:string,c=opticalCircuit()){return new Session(factory,readFileSync('public/machine.py','utf8'),code,{circuit:compileCircuit(c)},()=>{},{'lab_max30102.py':readFileSync('public/drivers/lab_max30102.py','utf8')});}
const prefix='from machine import Pin,I2C\nfrom time import sleep_ms\nfrom lab_max30102 import MAX30102\nbus=I2C(0,sda=Pin(8),scl=Pin(9),freq=100000)\ns=MAX30102(bus)\n';
test('real MicroPython driver executes register, FIFO, averaging, full recovery and shutdown calls',async()=>{
 const s=python(prefix+`s.configure(average=4)
sleep_ms(100)
assert 2 <= s.available() <= 3
a=s.read_sample()
assert len(a)==2 and 60000<a[0]<100000 and 70000<a[1]<110000
s.configure()
sleep_ms(800)
assert s.overflow()==31 and s.available()==32
assert s.read_sample() is not None and s.overflow()==0
s.shutdown(True)
s.clear_fifo()
sleep_ms(500)
assert s.available()==0
print('MAX_PROTOCOL_OK')
`);try{await s.wait((x:Session)=>['done','error'].includes(x.status),10000);assert.equal(s.status,'done',s.text+JSON.stringify(s.events.filter((e:any)=>e.type==='error')));assert(s.text.includes('MAX_PROTOCOL_OK'));save('micropython-protocol',{console:s.text,frame:last(s.events)});}finally{assert(await s.stop()<500);}
});
test('real MicroPython frequency example computes from FIFO, follows live 72→120 and contact loss',async()=>{
 const s=python(opticalExamples.opticalFrequency.code);try{
  await s.wait((x:Session)=>/FREQ=7[0-5]/.test(x.text)||x.status==='error',15000);assert.notEqual(s.status,'error',s.text+JSON.stringify(s.events.filter((e:any)=>e.type==='error')));
  assert(/FREQ=7[0-5]/.test(s.text),s.text);const before=s.text.length;s.input({component:'optical1',opticalRate:120});
  await s.wait((x:Session)=>/FREQ=1[12][0-9]/.test(x.text.slice(before))||x.status==='error',12000);assert(/FREQ=1[12][0-9]/.test(s.text.slice(before)),s.text);
  s.input({component:'optical1',opticalContact:false});await s.wait((x:Session)=>last(x.events)?.optical?.optical1?.last?.ir===500,5000);
  save('micropython-frequency-live',{console:s.text,frame:last(s.events)});
 }finally{assert(await s.stop()<500);}
});
const artifacts=JSON.parse(readFileSync('public/avr-examples.json','utf8'));
for(const board of [UNO,NANO] as const)for(const key of keys)test(board+': real AVR '+key,async()=>{
 const p=arduinoExampleProject(key,board),a=artifacts[board][key];await validateAVR(p,a);const events:any[]=[],e=new AVREngine(a.hex,compileCircuit(p.circuit as Circuit,'avr'),v=>events.push(v),board===NANO?8:6,a.staticRamBytes);
 const expected=key==='opticalRegisters'?/MAX SHUTDOWN FIFO=0/:key==='opticalRaw'?/RAW N=10 RED=\d+ IR=\d+/:key==='opticalFrequency'?/FREQ=7[0-5]/:/FIFO RECOVERED/;
 try{for(let ms=0;ms<10000&&!expected.test(output(events));ms+=100){e.runCycles(1600000);e.frame();}assert(expected.test(output(events)),output(events));assert.equal(last(events).diagnostics.filter(d=>d.severity==='error').length,0);assert(last(events).avr!.memory!.minFreeToStatic>500);save((board===UNO?'uno-':'nano-')+key,{console:output(events),frame:last(events),flash:a.flashBytes,sram:a.staticRamBytes});}finally{e.dispose();}
});
test('AVR missing SDA connection reports an error and yields no sample',()=>{
 const p=arduinoExampleProject('opticalRaw',UNO),c=p.circuit as Circuit;c.wires=c.wires.filter(w=>w.to.pin!=='SDA');const a=artifacts[UNO].opticalRaw,events:any[]=[],e=new AVREngine(a.hex,compileCircuit(c,'avr'),v=>events.push(v),6,a.staticRamBytes);try{e.runCycles(16000000);e.frame();assert(output(events).includes('MAX ERROR'));assert.equal(last(events).optical!.optical1.readings.length,0);}finally{e.dispose();}
});
for(const key of keys)test('real S3 WASM '+key,async()=>{
 const p=s3ExampleProject(key),a=JSON.parse(readFileSync('public/s3-examples.json','utf8'))[key];await validateS3(p,a);const events:any[]=[],e=await createS3Engine(wasmBytes(a.wasm),compileCircuit(p.circuit as Circuit),(v:any)=>events.push(v),{fast:true});
 try{await e.run(key==='opticalFrequency'?3500:key==='opticalRaw'?100:1);const text=output(events);assert(key==='opticalFrequency'?/FREQ=7[0-5]/.test(text):key==='opticalRaw'?text.includes('RAW N=10'):key==='opticalRegisters'?text.includes('MAX SHUTDOWN FIFO=0'):text.includes('FIFO RECOVERED'),text);assert.equal(last(events).diagnostics.filter(d=>d.severity==='error').length,0);save('s3-'+key,{console:text,frame:last(events),wasmBytes:a.wasmBytes});}finally{e.stop();}
});
