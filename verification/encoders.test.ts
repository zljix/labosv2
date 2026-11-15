import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {Worker} from 'node:worker_threads';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {encoderCircuit,encoderExamples,type EncoderExample} from '../src/circuit/encoderExamples';
import {compileCircuit,type SimulationFrame} from '../src/circuit/compile';
import {makePart,parseCircuit,localTerminals,terminals,type Circuit} from '../src/circuit/model';
import {checkCircuit} from '../src/circuit/netlist';
import {newProject,parseProject} from '../src/project/model';
import {exportZip,importProject} from '../src/project/archive';
import {S3,UNO,NANO,type BoardId} from '../src/boards/profiles';
import {arduinoExampleProject} from '../src/runtime/arduinoExamples';
import {validateArtifact,AVR_BUILD_FILE} from '../public/avr-contract.mjs';
import {createCircuitHost} from '../public/circuit-host.mjs';
import {AVREngine} from '../src/runtime/avrEngine';
import {Session} from '../dist/session.mjs';
import {compileProject} from '../scripts/avr-compile.mjs';

const keys=Object.keys(encoderExamples) as EncoderExample[];
const machine=readFileSync('public/machine.py','utf8'),driver=readFileSync('public/drivers/lab_encoder.py','utf8');
const artifacts=JSON.parse(readFileSync('public/avr-examples.json','utf8'));
mkdirSync('docs/stage13a-evidence',{recursive:true});
const text=(events:any[])=>events.filter(e=>e.type==='console').map(e=>e.text).join('');
const frame=(events:any[])=>events.filter(e=>e.type==='simulation').at(-1) as SimulationFrame;
const data=(events:any[],prefix:string)=>text(events).split(/\r?\n/).filter(l=>l.startsWith(prefix)).at(-1)??'';
function host(key:EncoderExample='ky040',edit=(c:Circuit)=>{},board:BoardId=S3){
 const c=encoderCircuit(key,board);edit(c);let now=0;const events:any[]=[];
 const h=createCircuitHost((e:any)=>events.push(e),{circuit:compileCircuit(c,board===S3?'micropython':'avr'),logicVoltage:board===S3?3.3:5,nowUs:()=>now,manualPublish:true});
 const pins=board===S3?[4,5,6]:[2,3,4];pins.forEach((p,i)=>h.mode(p,0,i===2?1:0));
 return {c,h,events,pins,setTime:(us:number)=>{now=us;h.timedStep();},bits:()=>pins.map((p,i)=>h.read(p,i===2?1:0)),frame:()=>{h.flush();return frame(events);}};
}
const factory=()=>{const w=new Worker(new URL('./node-worker.mjs',import.meta.url)),shim:any={postMessage:(d:any)=>w.postMessage(d),terminate:()=>w.terminate()};w.on('message',data=>shim.onmessage?.({data}));w.on('error',error=>shim.onerror?.(error));return shim;};
function python(key:EncoderExample,code=encoderExamples[key].code,c=encoderCircuit(key)){
 return new Session(factory,machine,code,{circuit:compileCircuit(c)},undefined,key==='encoderRaw'?{}:{'lab_encoder.py':driver});
}
function avr(key:EncoderExample,board:typeof UNO|typeof NANO,edit=(c:Circuit)=>{}){
 const c=encoderCircuit(key,board);edit(c);const a=artifacts[board][key],events:any[]=[];
 const e=new AVREngine(a.hex,compileCircuit(c,'avr'),x=>events.push(x),board===NANO?8:6,a.staticRamBytes);return {e,events};
}
function advance(e:AVREngine,ms=400){for(let n=0;n<ms;n+=10){e.runCycles(160000);e.frame();}}
function save(name:string,result:any){writeFileSync('docs/stage13a-evidence/'+name+'.json',JSON.stringify(result,null,2)+'\n');}

test('four encoder examples on three boards preserve profiles, source and artifacts through ZIP',async()=>{
 for(const board of [S3,UNO,NANO]as const)for(const key of keys){
  const p=board===S3?newProject(encoderExamples[key].code,encoderExamples[key].title):arduinoExampleProject(key,board);p.circuit=encoderCircuit(key,board);
  if(board===S3&&key!=='encoderRaw')p.files['lab_encoder.py']=driver;
  assert.deepEqual(parseCircuit(p.circuit),p.circuit);assert.equal(checkCircuit(p.circuit).diagnostics.length,0);
  if(board!==S3){await validateArtifact(p,artifacts[board][key]);p.files[AVR_BUILD_FILE]=JSON.stringify(artifacts[board][key]);}
  const imported=importProject(exportZip(p),'encoder.zip');assert.deepEqual(imported,parseProject(p));
  if(board!==S3)await validateArtifact(imported,JSON.parse(imported.files[AVR_BUILD_FILE]));
 }
});
test('profile rejects malformed position, speed, switch and bounce; five terminals rotate correctly',()=>{
 for(const [key,v]of [['encoderPosition',NaN],['encoderPosition',.5],['encoderPosition',10001],['encoderEdgeMs',4],['encoderEdgeMs',101],['encoderBounce',1],['pressed','yes'],['moduleVoltage',4]]as const){const c=encoderCircuit('ky040');(c.components[1].properties as any)[key]=v;assert.throws(()=>parseCircuit(c));}
 const p=makePart('ky040',0,0,'enc');assert.deepEqual(localTerminals(p).map(t=>t.pin),['GND','VCC','SW','DT','CLK']);p.rotation=90;assert.notDeepEqual(terminals(p),localTerminals(p));
});
test('CW and CCW produce exactly one-bit Gray transitions and four edges per detent',()=>{
 for(const board of [S3,UNO,NANO]as const){const t=host('ky040',()=>{},board);try{
  assert.deepEqual(t.bits(),[1,1,1]);t.h.input({component:'enc1',encoderPosition:1});
  for(const [i,b]of [[0,[0,1,1]],[1,[0,0,1]],[2,[1,0,1]],[3,[1,1,1]]] as [number,number[]][]){t.setTime((i+1)*20000);assert.deepEqual(t.bits(),b);}
  assert.equal(t.frame().encoders!.enc1.position,1);t.h.input({component:'enc1',encoderPosition:0});
  for(const [i,b]of [[0,[1,0,1]],[1,[0,0,1]],[2,[0,1,1]],[3,[1,1,1]]] as [number,number[]][]){t.setTime(80000+(i+1)*20000);assert.deepEqual(t.bits(),b);}
  const f=t.frame().encoders!.enc1;assert.equal(f.position,0);assert.equal(f.transitions,8);assert(!f.busy);assert.equal(t.frame().diagnostics.length,0);
 }finally{t.h.dispose();}}
});
test('queue preserves direction reversal before completion and reports completed versus requested position',()=>{
 const t=host();try{t.h.input({component:'enc1',encoderPosition:2});t.setTime(30000);assert.deepEqual(t.bits(),[0,1,1]);t.h.input({component:'enc1',encoderPosition:-1});
  let f=t.frame().encoders!.enc1;assert.equal(f.position,0);assert.equal(f.targetPosition,-1);assert(f.busy);
  t.setTime(400000);f=t.frame().encoders!.enc1;assert.equal(f.position,-1);assert.equal(f.transitions,20);assert(!f.busy);
  const tr=f.trace;for(let i=1;i<tr.length;i++)assert([1,2].includes(((tr[i-1].clk<<1)|tr[i-1].dt)^((tr[i].clk<<1)|tr[i].dt)));
 }finally{t.h.dispose();}
});
test('deterministic contact bounce has twenty edges per detent and bounded trace',()=>{
 const t=host('encoderBounce');try{
  t.h.input({component:'enc1',encoderPosition:1});const states=[];for(const us of [20000,20200,20400,20600,20800]){t.setTime(us);states.push(t.bits().slice(0,2));}
  assert.deepEqual(states,[[0,1],[1,1],[0,1],[1,1],[0,1]]);t.setTime(83200);const f=t.frame().encoders!.enc1;assert.equal(f.position,1);assert.equal(f.transitions,20);
  for(let i=0;i<10;i++){t.h.input({component:'enc1',encoderPosition:i+2});t.setTime(83200*(i+2));t.frame();}assert.equal(t.frame().encoders!.enc1.trace.length,128);
 }finally{t.h.dispose();}
});
test('CLK/DT pull-ups are resistors and SW is passive with no hidden pull-up',()=>{
 const t=host();try{t.h.mode(6,0);assert.equal(t.h.read(6),-1);assert(t.frame().diagnostics.some(d=>d.code==='encoder-floating'));t.h.input({component:'enc1',pressed:true});assert.equal(t.h.read(6),0);t.h.input({component:'enc1',pressed:false});assert.equal(t.h.read(6,1),1);}finally{t.h.dispose();}
 const loaded=host('ky040',c=>{const r=makePart('resistor',900,100,'load');r.properties.resistance=10000;c.components.push(r);for(const [pin,to]of [['1','CLK'],['2','GND']])c.wires.push({id:'load'+pin,from:{component:r.id,pin},to:{component:'enc1',pin:to},points:[],color:'#334155'});});try{assert.equal(loaded.h.read(4),-3);assert(Math.abs(loaded.frame().encoders!.enc1.volts.CLK!-1.65)<.001);}finally{loaded.h.dispose();}
});
test('passive contacts still switch with absent VCC, while supply failure remains visible',()=>{
 const t=host('ky040',c=>{c.wires=c.wires.filter(w=>w.to.pin!=='VCC');});try{assert(!t.frame().encoders!.enc1.powered);assert(t.frame().diagnostics.some(d=>d.code==='encoder-supply'));t.h.input({component:'enc1',pressed:true});assert.equal(t.h.read(6,1),0);t.h.input({component:'enc1',pressed:false});assert.equal(t.h.read(6,1),1);}finally{t.h.dispose();}
 const missing=host('ky040',c=>{c.wires=c.wires.filter(w=>w.to.pin!=='GND');});try{missing.h.input({component:'enc1',pressed:true});assert.notEqual(missing.h.read(6,1),0);assert(!missing.frame().encoders!.enc1.powered);}finally{missing.h.dispose();}
});
test('5 V ESP32 pull-ups and merged channels block start; Nano A6/A7 and open signals warn',()=>{
 const high=encoderCircuit('ky040');high.components[1].properties.moduleVoltage=5;high.wires.find(w=>w.to.pin==='VCC')!.from.pin='J1.21';assert.throws(()=>compileCircuit(high),/pull-up CLK\/DT/);
 const wrong=encoderCircuit('ky040');wrong.wires.find(w=>w.to.pin==='VCC')!.from.pin='J1.21';assert.throws(()=>compileCircuit(wrong),/3,3 V/);
 const merged=encoderCircuit('ky040');merged.wires.push({id:'merge',from:{component:'enc1',pin:'CLK'},to:{component:'enc1',pin:'DT'},color:'#334155',points:[]});assert.throws(()=>compileCircuit(merged),/tri zasebne mreže/);
 const nano=encoderCircuit('ky040',NANO);nano.wires.find(w=>w.to.pin==='CLK')!.from.pin='A6';assert(checkCircuit(nano).diagnostics.some(d=>d.code==='encoder-digital-pin'));
 const t=host('ky040',c=>{c.wires=c.wires.filter(w=>w.to.pin!=='DT');});try{assert(t.frame().diagnostics.some(d=>d.code==='encoder-signal-open'));}finally{t.h.dispose();}
});
test('active HIGH against a closed CLK or SW contact reports output conflict',()=>{
 const t=host();try{assert.equal(t.h.mode(4,1,0,1),0);t.h.input({component:'enc1',encoderPosition:1});t.setTime(20000);assert.equal(t.h.electricalStatus(),-2);assert(t.frame().diagnostics.some(d=>d.code==='encoder-output-conflict'));}finally{t.h.dispose();}
 const sw=host();try{sw.h.mode(6,1,0,1);sw.h.input({component:'enc1',pressed:true});assert.equal(sw.h.electricalStatus(),-2);}finally{sw.h.dispose();}
});
test('independent instances retain separate phases, queues, switch and initial offsets',()=>{
 const t=host('ky040',c=>{const p=makePart('ky040',900,200,'enc2');p.properties.encoderPosition=12;c.components.push(p);const b=c.components[0];for(const [pin,gpio]of [['CLK',8],['DT',9],['SW',10]]as const)c.wires.push({id:'second'+pin,from:{component:b.id,pin:terminals(b).find(t=>t.gpio===gpio)!.pin},to:{component:p.id,pin},color:'#087f8c',points:[]});for(const pin of ['VCC','GND'])c.wires.push({id:'second'+pin,from:{component:'enc1',pin},to:{component:p.id,pin},color:'#087f8c',points:[]});});
 try{t.h.mode(10,0,1);t.h.input({component:'enc1',encoderPosition:2,pressed:true});t.setTime(160000);let f=t.frame();assert.equal(f.encoders!.enc1.position,2);assert.equal(f.encoders!.enc2.position,12);assert.equal(t.h.read(10,1),1);t.h.input({component:'enc2',encoderPosition:11});t.setTime(240000);f=t.frame();assert.equal(f.encoders!.enc2.position,11);assert.equal(f.encoders!.enc1.position,2);}finally{t.h.dispose();}
 const fresh=host();try{assert.equal(fresh.frame().encoders!.enc1.position,0);assert.deepEqual(fresh.bits(),[1,1,1]);}finally{fresh.h.dispose();}
});
test('live malformed targets are ignored and queue overload is bounded without altering saved circuit',()=>{
 const t=host();try{for(const encoderPosition of [NaN,Infinity,1.1,10001])t.h.input({component:'enc1',encoderPosition});assert.equal(t.frame().encoders!.enc1.targetPosition,0);assert.throws(()=>t.h.input({component:'enc1',encoderPosition:33}),/najviše 32/);t.h.input({component:'enc1',encoderPosition:1});assert.equal(t.c.components[1].properties.encoderPosition,0);}finally{t.h.dispose();}
});
for(const key of keys)test(`real MicroPython ${key}: wired signals, live direction or PWM and prompt stop`,async()=>{
 const s=python(key);try{
  const prefix=key==='encoderRaw'?'RAW':key==='encoderPWM'?'PWM=50':'ENC READY';await s.wait((s:Session)=>s.text.includes(prefix));s.input({component:'enc1',encoderPosition:1});
  if(key==='encoderRaw'){await s.wait((s:Session)=>s.text.includes('RAW CLK=1 DT=0 SW=1'));s.input({component:'enc1',pressed:true});await s.wait((s:Session)=>s.text.includes('SW=0'));}
  else if(key==='encoderPWM'){
   await s.wait((s:Session)=>s.text.includes('PWM=55'));assert(frame(s.events).leds.encLED.brightness>.05);s.input({component:'enc1',encoderPosition:0});await s.wait((s:Session)=>s.text.split('PWM=50').length>=3);s.input({component:'enc1',encoderPosition:1});await s.wait((s:Session)=>s.text.split('PWM=55').length>=3);s.input({component:'enc1',pressed:true});await s.wait((s:Session)=>s.text.split('PWM=50').length>=4);
  }else{
   await s.wait((s:Session)=>s.text.includes('ENC P=1 DIR=CW'));s.input({component:'enc1',encoderPosition:-1});await s.wait((s:Session)=>s.text.includes('ENC P=-1 DIR=CCW'));s.input({component:'enc1',pressed:true});await s.wait((s:Session)=>s.text.includes('ENC RESET P=0'));const before=s.text;s.input({component:'enc1',encoderPosition:0});await s.wait((s:Session)=>s.text.slice(before.length).includes('ENC P=1 DIR=CW'));
  }
  assert.equal(frame(s.events).diagnostics.length,0);save('micropython-'+key,{console:s.text,frame:frame(s.events)});
 }finally{assert(await s.stop()<500);}
});
test('MicroPython incremental decoder starts at zero despite a nonzero physical offset',async()=>{
 const c=encoderCircuit('ky040');c.components[1].properties.encoderPosition=20;const s=python('ky040',undefined,c);try{await s.wait((s:Session)=>s.text.includes('ENC READY P=0'));s.input({component:'enc1',encoderPosition:21});await s.wait((s:Session)=>s.text.includes('ENC P=1 DIR=CW')&&frame(s.events).encoders!.enc1.position===21);}finally{await s.stop();}
});
test('slow MicroPython polling loses edges rather than receiving the model position',async()=>{
 const code=encoderExamples.ky040.code.replace('sleep_ms(1)','sleep_ms(100)'),s=python('ky040',code);try{await s.wait((s:Session)=>s.text.includes('ENC READY'));s.input({component:'enc1',encoderPosition:10});await s.wait((s:Session)=>frame(s.events)?.encoders?.enc1.position===10);assert(!s.text.includes('ENC P=10 '));save('slow-poll',{console:s.text,frame:frame(s.events)});}finally{await s.stop();}
});
test('visible Python decoder rejects diagonals and cancels partial reversal before a full detent',async()=>{
 const code=`from lab_encoder import Encoder
class TestPin:
    def __init__(self, value): self.n = value
    def value(self): return self.n
a, b, sw = TestPin(1), TestPin(1), TestPin(1)
e = Encoder(a, b, sw)
def feed(states):
    steps = 0
    for state in states:
        a.n, b.n = state >> 1, state & 1
        step, pressed = e.update()
        steps += step
    return steps
# Partial CW movement followed by reversal is zero, not two detents.
assert feed((1, 0, 1, 3)) == 0 and e.position == 0
assert feed((1, 0, 2, 3)) == 1 and e.position == 1
assert feed((2, 0, 1, 3)) == -1 and e.position == 0
# Both bits change: discard until idle, then resynchronize.
assert feed((0, 2, 3)) == 0 and e.errors == 1
assert feed((1, 0, 2, 3)) == 1 and e.position == 1
print("GRAY_UNIT_OK")
`;
 const s=python('ky040',code);try{await s.wait((s:Session)=>['done','error'].includes(s.status));assert.equal(s.status,'done',s.text);assert(s.text.includes('GRAY_UNIT_OK'));}finally{await s.stop();}
});
test('real compiled AVR INT0/INT1 receive scheduled bouncing contacts on both boards',{skip:!process.env.LAB_ARDUINO_CLI},async()=>{
 const source=`volatile long count=0;
volatile uint8_t previous=3;
volatile int8_t partial=0;
const int8_t delta[16]={0,-1,1,0,1,0,0,-1,-1,0,0,1,0,1,-1,0};
void changed(){uint8_t now=(digitalRead(2)<<1)|digitalRead(3);if((now^previous)==3)partial=0;else partial+=delta[(previous<<2)|now];if(now==3){if(partial==4)count++;if(partial==-4)count--;partial=0;}previous=now;}
void setup(){pinMode(2,INPUT);pinMode(3,INPUT);pinMode(4,INPUT_PULLUP);Serial.begin(9600);attachInterrupt(digitalPinToInterrupt(2),changed,CHANGE);attachInterrupt(digitalPinToInterrupt(3),changed,CHANGE);}
void loop(){noInterrupts();long n=count;interrupts();Serial.print(F("IRQ="));Serial.println(n);delay(60);}
`;
 const records=[];
 for(const board of [UNO,NANO]as const){const p=arduinoExampleProject('encoderBounce',board);p.files['main.ino']=source;const a=await compileProject(p);await validateArtifact(p,a);const events:any[]=[],c=p.circuit as Circuit;c.components[1].properties.encoderEdgeMs=5;const e=new AVREngine(a.hex,compileCircuit(c,'avr'),x=>events.push(x),board===NANO?8:6,a.staticRamBytes);
  try{advance(e,100);e.input({component:'enc1',encoderPosition:5});advance(e,250);assert.equal(data(events,'IRQ='),'IRQ=5');e.input({component:'enc1',encoderPosition:-2});advance(e,350);assert.equal(data(events,'IRQ='),'IRQ=-2');assert.equal(frame(events).diagnostics.length,0);records.push({board,source,artifact:a,console:text(events),frame:frame(events)});}finally{e.dispose();}
 }save('interrupts',records);
});
for(const board of [UNO,NANO]as const)test(`${board}: four real AVR examples decode contact edges and reset through SW`,()=>{
 const results=[];
 for(const key of keys){const t=avr(key,board);try{advance(t.e,150);assert(text(t.events));t.e.input({component:'enc1',encoderPosition:1});advance(t.e,key==='encoderRaw'?700:400);
  if(key==='encoderRaw'){assert(text(t.events).includes('RAW CLK=0 DT=1 SW=1'));assert(text(t.events).includes('RAW CLK=1 DT=0 SW=1'));t.e.input({component:'enc1',pressed:true});advance(t.e,100);assert(text(t.events).includes('SW=0'));}
  else if(key==='encoderPWM'){assert(text(t.events).includes('PWM=55'));assert(frame(t.events).leds.encLED.brightness>.05);t.e.input({component:'enc1',pressed:true});advance(t.e,100);assert.equal(data(t.events,'PWM='),'PWM=50');}
  else{assert(text(t.events).includes('ENC P=1 DIR=CW ERR=0'));t.e.input({component:'enc1',encoderPosition:-1});advance(t.e,400);assert(text(t.events).includes('ENC P=-1 DIR=CCW ERR=0'));t.e.input({component:'enc1',pressed:true});advance(t.e,100);assert(text(t.events).includes('ENC RESET P=0'));}
  assert.equal(frame(t.events).diagnostics.length,0);results.push({key,console:text(t.events),frame:frame(t.events),flash:artifacts[board][key].flashBytes,staticRam:artifacts[board][key].staticRamBytes});
 }finally{t.e.dispose();}}
 save(board===UNO?'uno-examples':'nano-examples',results);
});
test('AVR disconnected CLK remains visible and cannot produce a valid displacement',()=>{
 const t=avr('ky040',UNO,c=>{c.wires=c.wires.filter(w=>w.to.pin!=='CLK');});try{advance(t.e,150);t.e.input({component:'enc1',encoderPosition:2});advance(t.e,400);assert(!text(t.events).includes('ENC P=2 '));assert(frame(t.events).diagnostics.some(d=>d.code==='encoder-signal-open'));}finally{t.e.dispose();}
});
test('production Nano Worker runs queued live encoder turns and stops promptly',async()=>{
 const manifest=JSON.parse(readFileSync('dist/offline-package.json','utf8')),asset=manifest.files.find((f:any)=>/^\/assets\/avrWorker-.*\.js$/.test(f.url));assert(asset);
 const a=artifacts[NANO].encoderBounce,events:any[]=[],w=new Worker(new URL('./avr-built-worker.mjs',import.meta.url),{workerData:{path:pathToFileURL(resolve('dist'+asset.url)).href}});
 let pending:{check:()=>boolean;done:()=>void;fail:(e:Error)=>void}|undefined;
 const wait=(check:()=>boolean)=>new Promise<void>((ok,bad)=>{if(check()){ok();return;}const timer=setTimeout(()=>{pending=undefined;bad(Error('Worker timeout '+text(events)));},20000);pending={check,done:()=>{clearTimeout(timer);pending=undefined;ok();},fail:e=>{clearTimeout(timer);pending=undefined;bad(e);}};});
 w.on('message',e=>{events.push(e);if(e.type==='error')pending?.fail(Error(e.message));else if(pending?.check())pending.done();});w.on('error',e=>pending?.fail(e));
 try{w.postMessage({type:'run',session:131,hex:a.hex,circuit:compileCircuit(encoderCircuit('encoderBounce',NANO),'avr'),adcChannels:8,staticRamBytes:a.staticRamBytes});await wait(()=>text(events).includes('ENC READY'));w.postMessage({type:'input',session:131,component:'enc1',encoderPosition:2});await wait(()=>text(events).includes('ENC P=2 DIR=CW'));w.postMessage({type:'input',session:131,component:'enc1',encoderPosition:-1});await wait(()=>text(events).includes('ENC P=-1 DIR=CCW'));const at=performance.now();await w.terminate();const stopMs=performance.now()-at;assert(stopMs<500);save('production-worker',{version:manifest.version,build:manifest.build,console:text(events),stopMs,scope:'Node/Linux production bundle; not physical hardware or target browser'});}finally{await w.terminate();}
});
