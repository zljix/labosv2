import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {Worker} from 'node:worker_threads';
import {createCircuitHost} from '../public/circuit-host.mjs';
import {initialRTC,validRTCInitial,validRTCState} from '../public/rtc-ds1302.mjs';
import {rtcCircuit,rtcExamples,type RTCExample} from '../src/circuit/rtcExamples';
import {compileCircuit,type SimulationFrame} from '../src/circuit/compile';
import {parseCircuit,type Circuit} from '../src/circuit/model';
import {checkCircuit} from '../src/circuit/netlist';
import {S3,UNO,NANO,type BoardId} from '../src/boards/profiles';
import {newProject,parseProject} from '../src/project/model';
import {exportZip,importProject} from '../src/project/archive';
import {exportSketch} from '../src/project/sketch';
import {arduinoExampleProject} from '../src/runtime/arduinoExamples';
import {s3ExampleProject} from '../src/runtime/s3Examples';
import {validateArtifact as validateAVR} from '../public/avr-contract.mjs';
import {validateArtifact as validateS3,wasmBytes} from '../public/s3-contract.mjs';
import {AVREngine} from '../src/runtime/avrEngine';
import {createS3Engine} from '../public/s3-engine.mjs';
import {RTCSessionMemory} from '../src/runtime/rtcState';
import {Session} from '../public/session.mjs';
const dir='docs/stage19a-evidence';mkdirSync(dir,{recursive:true});
const save=(n:string,v:any)=>writeFileSync(dir+'/'+n+'.json',JSON.stringify(v,null,2)+'\n');
const last=(es:any[])=>es.filter(e=>e.type==='simulation').at(-1) as SimulationFrame;
const output=(es:any[])=>es.filter(e=>e.type==='console').map(e=>e.text).join('');
const keys=Object.keys(rtcExamples) as RTCExample[];
function fixture(edit:(c:Circuit)=>void=()=>{},board:BoardId=S3){
 const c=rtcCircuit('rtcRead',board);edit(c);let now=0;const events:any[]=[];
 const h=createCircuitHost((e:any)=>events.push(e),{circuit:compileCircuit(c,board===S3?'micropython':'avr'),logicVoltage:board===S3?3.3:5,manualPublish:true,nowUs:()=>now});
 const [ce,io,clk]=board===S3?[6,7,8]:[4,5,6];
 const put=(pin:number,value:number)=>{now+=10;const r=h.mode(pin,1,0,value);assert.equal(r,0);};
 put(ce,0);put(clk,0);
 const begin=()=>{put(ce,0);put(clk,0);put(io,0);put(ce,1);};
 const end=()=>{put(ce,0);now+=10;h.mode(io,0);};
 const byte=(value:number,reading=false)=>{for(let bit=0;bit<8;bit++){put(io,(value>>bit)&1);put(clk,1);if(reading&&bit===7){now+=10;assert.equal(h.mode(io,0),0);}put(clk,0);}};
 const input=()=>{let v=0;for(let bit=0;bit<8;bit++){now+=10;const r=h.read(io);assert(r>=0,`read ${r}`);v|=r<<bit;put(clk,1);put(clk,0);}return v;};
 const tx=(cmd:number,bytes:number[])=>{begin();byte(cmd);for(const b of bytes)byte(b);end();};
 const rx=(cmd:number,count=1)=>{begin();byte(cmd,true);const r=Array.from({length:count},()=>input());end();return r;};
 const state=()=>{h.flush();return last(events).rtcDevices!.rtc1;};
 return {c,h,events,put,ce,io,clk,begin,end,byte,input,tx,rx,state,wait:(us:number)=>{now+=us;h.flush();}};
}

test('strict calendar, BCD and serialized state validation reject normalization, DST and corrupt bytes',()=>{
 for(const date of ['2028-02-29T23:59:59','2000-02-29T00:00:00','2099-12-31T23:59:59'])assert(validRTCInitial(date));
 for(const date of ['2026-02-29T00:00:00','2028-02-30T00:00:00','2026-01-01T24:00:00','2100-01-01T00:00:00','2026-01-01T12:00:00Z','2026-01-01'])assert(!validRTCInitial(date),date);
 const s=initialRTC('2028-02-29T23:59:58');assert.deepEqual(s.registers,[0x58,0x59,0x23,0x29,2,3,0x28,0]);assert(validRTCState(s));
 for(const bad of [{...s,ram:[]},{...s,registers:[0,0,0,0,0,0,0,0]},{...s,subsecondUs:1000000},{...s,trickle:256}])assert(!validRTCState(bad));
});
for(const board of [S3,UNO,NANO] as const)test(board+': four RTC source/circuit projects round-trip and export actual sources',async()=>{
 for(const key of keys){const p=board===S3?newProject(rtcExamples[key].code,rtcExamples[key].title):arduinoExampleProject(key,board);p.circuit=rtcCircuit(key,board);assert.equal(checkCircuit(p.circuit).diagnostics.length,0);assert.deepEqual(parseCircuit(p.circuit),p.circuit);assert.equal(parseProject(p).schemaVersion,3);assert.deepEqual((await importProject(exportZip(p),'rtc.zip')).circuit,p.circuit);if(board!==S3)assert(exportSketch(p).length>500);}
 const p=newProject('print(1)');p.circuit=rtcCircuit();p.circuit.components.find(d=>d.id==='rtc1')!.properties.rtcState=initialRTC('2028-02-29T12:00:00');assert.deepEqual((await importProject(exportZip(p),'rtc.zip')).circuit,p.circuit);
});
test('rising command/write bits and falling reply bits read fixed independent BCD bytes',()=>{
 const f=fixture();try{assert.deepEqual(f.rx(0xbf,8),[0,0,0x12,1,1,5,0x26,0]);assert.equal(f.state().errors,0);assert(f.state().received===1);assert(f.state().trace.some(t=>t.operation==='read-byte'));}finally{f.h.dispose();}
});
test('clock writes commit on falling CE; incomplete burst is discarded and trailing bytes ignored',()=>{
 const f=fixture();try{
  f.tx(0xbe,[0x58,0x59,0x23,0x28,2,2,0x28]);assert.equal(f.state().iso,'2026-01-01T12:00:00');
  f.begin();f.byte(0xbe);for(const n of [0x58,0x59,0x23,0x28,2,2,0x28,0])f.byte(n);assert.equal(f.state().iso,'2026-01-01T12:00:00');f.end();assert.equal(f.state().iso,'2028-02-28T23:59:58');
  f.tx(0x82,[0x17,0x45]);assert.equal(f.rx(0x83)[0],0x17);assert.equal(f.rx(0x85)[0],0x23);
 }finally{f.h.dispose();}
});
test('calendar handles leap day, short months, midnight day register and year rollover',()=>{
 for(const [date,expected]of [['2028-02-28T23:59:59','2028-02-29T00:00:00'],['2026-02-28T23:59:59','2026-03-01T00:00:00'],['2026-04-30T23:59:59','2026-05-01T00:00:00'],['2099-12-31T23:59:59','2000-01-01T00:00:00']]){
  const f=fixture(c=>c.components.find(d=>d.id==='rtc1')!.properties.rtcInitial=date);try{const day=f.state().day;f.wait(1000000);assert.equal(f.state().iso,expected);assert.equal(f.state().day,day%7+1);}finally{f.h.dispose();}
 }
});
test('12-hour 11:59:59 AM changes to 12 PM and 11 PM to midnight',()=>{
 for(const [hour,expected,next]of [[0x91,'2026-01-01T12:00:00',0xb2],[0xb1,'2026-01-02T00:00:00',0x92]] as const){const f=fixture();try{f.tx(0xbe,[0x59,0x59,hour,1,1,5,0x26,0]);f.wait(1000000);assert.equal(f.state().iso,expected);assert.equal(f.rx(0x85)[0],next);}finally{f.h.dispose();}}
});
test('CH freezes time; WP blocks clock and RAM including burst control, but control clears WP',()=>{
 const f=fixture();try{f.tx(0x80,[128]);const at=f.state().iso;f.wait(3000000);assert.equal(f.state().iso,at);assert(f.state().halted);f.tx(0x80,[0]);f.wait(1000000);assert.equal(f.state().iso,'2026-01-01T12:00:01');
 f.tx(0x8e,[128]);f.tx(0xc0,[99]);f.tx(0xbe,[0,0,0,2,2,2,0x27,0]);assert.equal(f.rx(0xc1)[0],0);assert(f.state().writeProtected);f.tx(0x8e,[0]);f.tx(0xc0,[42]);assert.equal(f.rx(0xc1)[0],42);
 }finally{f.h.dispose();}
});
test('RAM supports 31 single-byte addresses and partial/continuous bursts without clock aliasing',()=>{
 const f=fixture();try{for(let i=0;i<31;i++)f.tx(0xc0+2*i,[i*7&255]);assert.deepEqual(f.rx(0xff,31),Array.from({length:31},(_,i)=>i*7&255));f.tx(0xfe,[9,8,7]);assert.deepEqual(f.rx(0xff,4),[9,8,7,21]);assert.equal(f.rx(0xfd)[0],210);assert.deepEqual(f.rx(0xff,31).slice(0,3),[9,8,7]);assert.equal(f.state().iso,'2026-01-01T12:00:00');}finally{f.h.dispose();}
});
test('read snapshot is coherent across midnight; I/O is released with CE low',()=>{
 const f=fixture(c=>c.components.find(d=>d.id==='rtc1')!.properties.rtcInitial='2026-12-31T23:59:59');try{f.begin();f.byte(0xbf,true);const sec=f.input();f.wait(1500000);const rest=Array.from({length:7},()=>f.input());f.end();assert.deepEqual([sec,...rest],[0x59,0x59,0x23,0x31,0x12,5,0x26,0]);assert.equal(f.state().iso,'2027-01-01T00:00:00');assert.equal(f.h.read(f.io),0);}finally{f.h.dispose();}
});
test('missing main supply with battery retains time/RAM but cannot communicate; restore recovers',()=>{
 const f=fixture();try{f.tx(0xc0,[42]);f.h.input({component:'rtc1',rtcMainPower:false});assert(!f.state().mainPower);assert(f.state().retained);f.wait(3000000);assert.equal(f.state().iso,'2026-01-01T12:00:03');assert.deepEqual(f.rx(0xbf,8),Array(8).fill(0));f.h.input({component:'rtc1',rtcMainPower:true});assert.equal(f.rx(0xc1)[0],42);assert(f.state().mainPower);}finally{f.h.dispose();}
});
test('loss of both supplies invalidates calendar and erases RAM; restored supply needs initialization',()=>{
 const f=fixture(c=>c.components.find(d=>d.id==='rtc1')!.properties.rtcBattery=false);try{f.tx(0xc0,[42]);f.h.input({component:'rtc1',rtcMainPower:false});f.wait(5000000);assert.equal(f.state().iso,null);assert(!f.state().valid);f.h.input({component:'rtc1',rtcMainPower:true});assert.equal(f.rx(0xc1)[0],0);assert.equal(f.rx(0x81)[0],128);f.tx(0xbe,[0,0,0x12,1,1,5,0x26,0]);assert.equal(f.state().iso,'2026-01-01T12:00:00');}finally{f.h.dispose();}
});
test('invalid calendar is flagged; invalid command and unsupported address cannot mutate RAM/time',()=>{
 const f=fixture();try{f.tx(0,[42]);f.tx(0x92,[42]);assert.equal(f.state().iso,'2026-01-01T12:00:00');assert.equal(f.state().errors,2);f.tx(0x88,[0x13]);assert(!f.state().valid);assert.equal(f.state().iso,null);f.wait(5000000);assert.equal(f.rx(0x89)[0],0x13);f.tx(0x88,[1]);assert(f.state().valid);}finally{f.h.dispose();}
});
test('charging register is outside clock burst and enabled charging produces explicit diagnostic',()=>{
 const f=fixture();try{f.tx(0x90,[0xa5]);assert.equal(f.rx(0x91)[0],0xa5);assert.equal(f.rx(0xbf,8).length,8);f.h.flush();assert(last(f.events).diagnostics.some(d=>d.code==='rtc-charger'));}finally{f.h.dispose();}
});
test('wiring checks reject merged signals, Nano analog-only pins and 5 V S3 return path',()=>{
 const c=rtcCircuit();c.components.find(d=>d.id==='rtc1')!.properties.moduleVoltage=5;assert(checkCircuit(c).diagnostics.some(d=>d.code==='rtc-voltage-domain'));
 const n=rtcCircuit('rtcRead',NANO);n.wires.find(w=>w.to.pin==='IO')!.from.pin='A6';assert(checkCircuit(n).diagnostics.some(d=>d.code==='rtc-digital-pin'));
 const s=rtcCircuit();s.wires.find(w=>w.to.pin==='IO')!.from.pin=s.wires.find(w=>w.to.pin==='CE')!.from.pin;assert(checkCircuit(s).diagnostics.some(d=>d.code==='rtc-shared-signals'));
});
for(const pin of ['VCC','GND','CE','IO','SCLK'])test('unconnected '+pin+' cannot return valid calendar bytes',()=>{
 const f=fixture(c=>{c.wires=c.wires.filter(w=>w.to.pin!==pin);});try{let bytes:number[]|undefined;try{bytes=f.rx(0xbf,8);}catch(e){assert.match(String(e),/read -[123]/);}if(bytes)assert.notDeepEqual(bytes,[0,0,0x12,1,1,5,0x26,0]);}finally{f.h.dispose();}
});
test('GPIO driving opposite to RTC push-pull output is diagnosed',()=>{
 const f=fixture();try{f.begin();f.byte(0xbf,true);f.put(f.clk,1);f.put(f.clk,0);const status=f.h.mode(f.io,1,0,1);assert.equal(status,-2);f.h.flush();assert(last(f.events).diagnostics.some(d=>d.code==='rtc-output-conflict'));}finally{f.h.dispose();}
});
test('session snapshot survives MCU restart and source edits, stays isolated by project/topology/initial data',()=>{
 const p=newProject('print(1)');p.circuit=rtcCircuit();const memory=new RTCSessionMemory(),c=compileCircuit(p.circuit);memory.prepare(p,c);
 const f=fixture();try{f.tx(0xc0,[73]);f.wait(2500000);memory.observe(last(f.events));const restart=compileCircuit(p.circuit);memory.prepare(p,restart);assert.equal(restart.rtcDevices[0].rtcState!.ram[0],73);assert.equal(restart.rtcDevices[0].rtcState!.subsecondUs,f.state().state.subsecondUs);
 p.files['main.py']='print(2)';const edited=compileCircuit(p.circuit);memory.prepare(p,edited);assert.equal(edited.rtcDevices[0].rtcState!.ram[0],73);
 const other={...p,id:'other-project'};const noLeak=compileCircuit(p.circuit);memory.prepare(other,noLeak);assert.equal(noLeak.rtcDevices[0].rtcState,undefined);
 }finally{f.h.dispose();}
});

const avr=JSON.parse(readFileSync('public/avr-examples.json','utf8')),s3=JSON.parse(readFileSync('public/s3-examples.json','utf8'));
for(const board of [UNO,NANO]as const)for(const key of keys)test(board+': actual compiled '+key+' drives RTC GPIO and display',async()=>{
 const p=arduinoExampleProject(key,board);await validateAVR(p,avr[board][key]);const events:any[]=[];const a=avr[board][key],e=new AVREngine(a.hex,compileCircuit(p.circuit as Circuit,'avr'),(x:any)=>events.push(x),board===NANO?8:6,a.staticRamBytes);
 try{const ms=key==='rtcSet'?2400:key==='rtcMemory'?1400:300;for(let n=0;n<ms;n+=20){e.runCycles(320000);e.frame();}const state=last(events).rtcDevices!.rtc1;assert(state.mainPower&&state.valid);assert.equal(state.errors,0);assert(!output(events).includes('ERROR'),output(events));if(key==='rtcSet')assert.match(output(events),/2028-2-29 0:0:0/);if(key==='rtcMemory')assert.match(output(events),/RTC RAM=1 WP=1/);if(key==='rtcClock'){assert(last(events).tmDisplays!.tm1.on);assert.deepEqual(last(events).tmDisplays!.tm1.bytes.slice(0,4),[6,0x5b,0x3f,0x3f]);}assert.equal(last(events).diagnostics.length,0);save((board===UNO?'uno':'nano')+'-'+key,{text:output(events),frame:last(events)});}finally{e.dispose();}
});
for(const key of keys)test('S3 compiled '+key+' reads real GPIO replies and remains stoppable',async()=>{
 const p=s3ExampleProject(key);await validateS3(p,s3[key]);const events:any[]=[];const e=await createS3Engine(wasmBytes(s3[key].wasm),compileCircuit(p.circuit as Circuit),(x:any)=>events.push(x),{fast:true});
 try{await e.run(key==='rtcSet'?3:1);const state=last(events).rtcDevices!.rtc1;assert(state.valid);assert.equal(state.errors,0);assert(!output(events).includes('ERROR'),output(events));if(key==='rtcSet')assert.match(output(events),/2028-2-29 0:0:0/);if(key==='rtcMemory')assert.match(output(events),/RTC RAM=1 WP=1/);if(key==='rtcClock')assert(last(events).tmDisplays!.tm1.on);assert.equal(last(events).diagnostics.length,0);save('s3-'+key,{text:output(events),frame:last(events)});}finally{e.stop();}
});
const machine=readFileSync('public/machine.py','utf8'),py=readFileSync('public/drivers/lab_ds1302.py','utf8'),tm=readFileSync('public/drivers/lab_tm1637.py','utf8');
const factory=()=>{const w=new Worker(new URL('./node-worker.mjs',import.meta.url)),shim:any={postMessage:(d:any)=>w.postMessage(d),terminate:()=>w.terminate()};w.on('message',data=>shim.onmessage?.({data}));w.on('error',error=>shim.onerror?.(error));return shim;};
function python(code:string,c=rtcCircuit()){return new Session(factory,machine,code,{circuit:compileCircuit(c)},undefined,{'lab_ds1302.py':py,'lab_tm1637.py':tm});}
for(const key of keys)test('MicroPython '+key+' runs visible GPIO driver inside real WASM',async()=>{
 const code=rtcExamples[key].code.replace('while True:','for _ in range(3):');const s=python(code,rtcCircuit(key));
 try{await s.wait((s:Session)=>s.status==='done'||s.status==='error',16000);assert.equal(s.status,'done',s.text);assert(!s.text.includes('ERROR'),s.text);const state=last(s.events).rtcDevices!.rtc1;assert(state.valid);assert.equal(state.errors,0);if(key==='rtcSet')assert.match(s.text,/2028-02-29 00:00:00/);if(key==='rtcMemory')assert.match(s.text,/RTC RAM=1 WP=1/);if(key==='rtcClock')assert(last(s.events).tmDisplays!.tm1.on);save('python-'+key,{console:s.text,frame:last(s.events)});}finally{await s.stop();}
});
test('MicroPython driver rejects absent RTC rather than inventing a timestamp',async()=>{
 const c=rtcCircuit();c.wires=c.wires.filter(w=>w.to.pin!=='CE');const s=python('from machine import Pin\nfrom lab_ds1302 import DS1302\nsat=DS1302(Pin(6),Pin(7),Pin(8))\ntry:\n print(sat.datetime())\nexcept ValueError:\n print("RTC_MISSING_OK")\n',c);try{await s.wait((s:Session)=>s.status==='done'||s.status==='error');assert.equal(s.status,'done',s.text);assert(s.text.includes('RTC_MISSING_OK'));}finally{await s.stop();}
});


test('S3 C++ live main-power interruption reports invalid read, keeps running and recovers on battery',async()=>{
 const p=s3ExampleProject('rtcRead'),events:any[]=[];let phase=0,e:any;
 e=await createS3Engine(wasmBytes(s3.rtcRead.wasm),compileCircuit(p.circuit as Circuit),(x:any)=>{events.push(x);if(x.type==='console'&&x.text.includes('RTC 2026')&&phase===0){phase=1;e.input({component:'rtc1',rtcMainPower:false});}else if(x.type==='console'&&x.text.includes('RTC ERROR')&&phase===1){phase=2;e.input({component:'rtc1',rtcMainPower:true});}},{fast:true});
 try{await e.run(4);assert.equal(phase,2);assert.match(output(events),/RTC 2026[\s\S]*RTC ERROR[\s\S]*RTC 2026/);assert(last(events).rtcDevices!.rtc1.valid);save('s3-power-recovery',{console:output(events),frame:last(events)});}finally{e.stop();}
});
test('S3 compiled restart receives battery RAM snapshot and increments it without resetting clock',async()=>{
 const p=s3ExampleProject('rtcMemory'),events:any[]=[];let e=await createS3Engine(wasmBytes(s3.rtcMemory.wasm),compileCircuit(p.circuit as Circuit),(x:any)=>events.push(x),{fast:true});
 await e.run(2);e.stop();const retained=last(events).rtcDevices!.rtc1.state,config=compileCircuit(p.circuit as Circuit);config.rtcDevices[0].rtcState=retained;
 const next:any[]=[];e=await createS3Engine(wasmBytes(s3.rtcMemory.wasm),config,(x:any)=>next.push(x),{fast:true});try{await e.run(1);assert.match(output(next),/RTC RAM=2 WP=1/);assert(last(next).rtcDevices!.rtc1.state.registers[0]>=retained.registers[0]);save('s3-reset',{before:output(events),after:output(next),state:last(next).rtcDevices});}finally{e.stop();}
});
