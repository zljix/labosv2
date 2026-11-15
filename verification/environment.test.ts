import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {Worker} from 'node:worker_threads';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {Session} from '../dist/session.mjs';
import {BMP180,BMP280,AM2320,crc16} from '../public/environment-sensors.mjs';
import {environmentCircuit,environmentExamples,type EnvironmentExample} from '../src/circuit/environmentExamples';
import {UNO,NANO} from '../src/boards/profiles';
import {arduinoExampleProject} from '../src/runtime/arduinoExamples';
import {AVREngine} from '../src/runtime/avrEngine';
import {compileCircuit,type SimulationFrame} from '../src/circuit/compile';
import {checkCircuit} from '../src/circuit/netlist';
import {parseCircuit,type Circuit} from '../src/circuit/model';
import {newProject,parseProject} from '../src/project/model';
import {exportZip,importProject} from '../src/project/archive';
import {AVR_BUILD_FILE,validateArtifact} from '../public/avr-contract.mjs';

const machine=readFileSync('public/machine.py','utf8');
const files=Object.fromEntries(['lab_i2c_sensors.py','ssd1306.py'].map(n=>[n,readFileSync('public/drivers/'+n,'utf8')]));
const artifacts=JSON.parse(readFileSync('public/avr-examples.json','utf8'));
const keys=['bmp180','bmp280','am2320','weather']as const;
const factory=()=>{const w=new Worker(new URL('./node-worker.mjs',import.meta.url));const shim:any={postMessage:(d:any)=>w.postMessage(d),terminate:()=>w.terminate()};w.on('message',data=>shim.onmessage?.({data}));w.on('error',error=>shim.onerror?.(error));return shim;};
const eventsText=(events:any[])=>events.filter(e=>e.type==='console').map(e=>e.text).join('');
const frame=(events:any[])=>events.filter(e=>e.type==='simulation').at(-1)as SimulationFrame;
const python=(key:EnvironmentExample,code=environmentExamples[key].code,c=environmentCircuit(key),driverFiles=files)=>new Session(factory,machine,code,{circuit:compileCircuit(c)},()=>{},driverFiles);
async function done(key:EnvironmentExample,code:string,c=environmentCircuit(key),ok=true,driverFiles=files){
  const s=python(key,code,c,driverFiles);try{await s.wait((s:Session)=>['done','error'].includes(s.status));assert.equal(s.status,ok?'done':'error',s.text+' '+JSON.stringify(s.events.filter((e:any)=>e.type==='error')));return {text:s.text,frame:frame(s.events),events:s.events};}finally{await s.stop();}
}
const prefix='from machine import Pin,I2C\nfrom time import sleep_ms\nfrom lab_i2c_sensors import BMP180,BMP280,AM2320\nbus=I2C(0,sda=Pin(8),scl=Pin(9),freq=100000)\n';
const put=(d:any,r:number,v:number)=>{d.onAddress(true);d.write(Uint8Array.of(r,v));d.end(true);};
const get=(d:any,r:number,n:number)=>{d.onAddress(true);d.write(Uint8Array.of(r));d.end(true);d.onAddress(false);const b=d.read(n);d.end(false);return [...b];};

test('Bosch BMP180 published reference: calibration endian/sign, UT=27898, UP=23843, 15 C and 69964 Pa',()=>{
 let now=0;const d=new BMP180({temperature:15,pressure:69964},()=>now);now=20;
 assert.deepEqual(get(d,0xaa,6),[1,152,255,184,199,209]);assert.deepEqual(get(d,0xd0,1),[0x55]);
 put(d,0xf4,0x2e);assert(get(d,0xf4,1)[0]&32);now=24.499;assert(get(d,0xf4,1)[0]&32);now=24.5;
 assert.deepEqual(get(d,0xf6,2),[0x6c,0xfa]);assert.equal(get(d,0xf4,1)[0]&32,0);
 put(d,0xf4,0x34);now=29;assert.deepEqual(get(d,0xf6,3),[0x5d,0x23,0]);assert.equal(d.sample,1);
 assert.equal(d.snapshot(true).measuredTemperature,15);assert.equal(d.snapshot(true).measuredPressure,69964);
 put(d,0xe0,0xb6);assert.equal(d.snapshot(true).measuredPressure,null);assert.throws(()=>put(d,0xaa,1));
});
test('BMP180 all OSS delays and raw words remain latched when live environment changes mid conversion',()=>{
 for(const [oss,delay]of [4.5,7.5,13.5,25.5].entries()){
  let now=20;const env={temperature:24,pressure:101325},d=new BMP180(env,()=>now);now=40;
  put(d,0xf4,0x34|(oss<<6));env.pressure=95000;now+=delay-.001;assert(get(d,0xf4,1)[0]&32);now+=.001;
  assert.equal(get(d,0xf4,1)[0]&32,0);assert(Math.abs(d.snapshot(true).measuredPressure!-101325)<4);assert.equal(d.sample,1);
 }
});
test('Bosch BMP280 reference: little-endian trims, ADC 519888/415148, startup, forced mode and sentinel reset',()=>{
 let now=0;const d=new BMP280({temperature:25.08247793081682,pressure:100653.26677582515},()=>now);
 assert.equal(get(d,0xf3,1)[0]&1,1);assert.deepEqual(get(d,0xf7,6),[128,0,0,128,0,0]);now=5;
 assert.deepEqual(get(d,0x88,6),[0x70,0x6b,0x43,0x67,0x18,0xfc]);assert.deepEqual(get(d,0xd0,1),[0x58]);
 put(d,0xf4,0x25);assert.equal(get(d,0xf3,1)[0],8);now=11.5;
 assert.deepEqual(get(d,0xf7,6),[0x65,0x5a,0xc0,0x7e,0xed,0]);assert.equal(get(d,0xf4,1)[0]&3,0);
 assert(Math.abs(d.snapshot(true).measuredPressure!-100653.2668)<.001);
 assert.throws(()=>put(d,0xf5,4),/IIR/);assert.throws(()=>put(d,0xd0,0));
 put(d,0xe0,0xb6);assert.equal(get(d,0xf3,1)[0]&1,1);assert.deepEqual(get(d,0xf7,6),[128,0,0,128,0,0]);
});
test('BMP280 normal mode, standby, skipped channels and burst shadowing are driven by virtual time',()=>{
 let now=0;const env={temperature:24,pressure:101325},d=new BMP280(env,()=>now);now=5;put(d,0xf5,0x20);put(d,0xf4,0x27);now=12;
 d.onAddress(true);d.write(Uint8Array.of(0xf7));d.end();d.onAddress(false);const first=[d.readByte()];
 env.pressure=95000;now=160;first.push(...d.read(5));assert.equal(d.sample,3);
 assert.notDeepEqual(first,get(d,0xf7,6));
 put(d,0xf4,0);put(d,0xf4,0x21);now+=8;assert.deepEqual(get(d,0xf7,3),[128,0,0]);assert.equal(d.snapshot(true).measuredPressure,null);
});
test('AM2320 startup, wake NACK, response delay, known CRC vector, negative sign and previous-sample cadence',()=>{
 assert.equal(crc16(Uint8Array.of(3,4,3,57,1,21)),0xfee1);
 let now=0;const env={temperature:-10.1,humidity:50},d=new AM2320(env,()=>now);assert(!d.onAddress(true));now=2000;assert(!d.onAddress(true));
 now=2000.79;assert(!d.onAddress(true));now=2001;assert(d.onAddress(true));d.write(Uint8Array.of(3,0,4));d.end(true);
 now=2002;assert(!d.onAddress(false));now=2003;assert(d.onAddress(false));const b=d.read(8);assert.deepEqual([...b.slice(0,6)],[3,4,1,244,128,101]);assert.equal(crc16(b.slice(0,6)),b[6]|(b[7]<<8));
 env.temperature=30;d.end(false);now+=100;assert(!d.onAddress(true));now+=1;assert(d.onAddress(true));assert.throws(()=>d.write(Uint8Array.of(3,0,4)),/2 s/);
 now=4104;d.awake=false;assert(!d.onAddress(true));now+=1;assert(d.onAddress(true));d.write(Uint8Array.of(3,0,4));d.end(true);now+=2;assert(d.onAddress(false));const fresh=d.read(8);assert.deepEqual([...fresh.slice(4,6)],[1,44]);assert.throws(()=>d.onAddress(true,400000),/100 kHz/);
});
test('all environment circuits, voltage profiles, source drivers and compiled artifacts survive JSON/ZIP',async()=>{
 for(const key of keys){const c=environmentCircuit(key);assert.equal(checkCircuit(c).diagnostics.length,0);assert.deepEqual(parseCircuit(c),c);const p=newProject(environmentExamples[key].code,environmentExamples[key].title);p.files={...files,...p.files};p.circuit=c;assert.deepEqual(importProject(exportZip(p),'env.zip'),parseProject(p));}
 for(const board of [UNO,NANO]as const)for(const key of keys){const p=arduinoExampleProject(key,board),a=artifacts[board][key];await validateArtifact(p,a);p.files[AVR_BUILD_FILE]=JSON.stringify(a);const next=importProject(exportZip(p),'env.zip');await validateArtifact(next,JSON.parse(next.files[AVR_BUILD_FILE]));assert(a.staticRamBytes<1500);assert.equal(checkCircuit(p.circuit as Circuit).diagnostics.length,0);}
 const c=environmentCircuit('bmp280');c.components[1].properties.address=0x75;assert.throws(()=>parseCircuit(c));c.components[1].properties.address=0x76;c.components[1].properties.pressure=110001;assert.throws(()=>parseCircuit(c));
 const collision=environmentCircuit('weather');collision.components.find(p=>p.kind==='bmp280')!.properties.address=0x77;assert.throws(()=>compileCircuit(collision),/adresu/);
});
test('real MicroPython memory read/write/into, repeated-start and register-driven calibration give physical values',async()=>{
 const r=await done('weather',prefix+`b=bytearray(2)
bus.readfrom_mem_into(0x76,0x88,b)
assert b==b'\\x70\\x6b'
for action in (lambda:bus.readfrom_mem(0x76,0x100,1),lambda:bus.writeto_mem(0x76,0,b'',addrsize=7)):
 try:
  action()
  raise AssertionError('address bounds')
 except ValueError:
  pass
for Sensor in (BMP180,BMP280):
 s=Sensor(bus)
 t,p=s.read()
 assert abs(t-24)<.11 and abs(p-101325)<5
 print(Sensor.__name__,t,p)
a=AM2320(bus)
t,h=a.read()
assert t==24 and h==50
print('ENV_PROTOCOL_OK')`);
 assert(r.text.includes('ENV_PROTOCOL_OK'));assert(r.frame.i2cTrace.some(t=>t.result.includes('bez STOP')));assert.equal(r.frame.measurements.length,3);assert.equal(r.frame.measurements[0].humidity,null);
});
test('real MicroPython signed temperature and boundary pressures are compensated by driver on both BMPs',async()=>{
 for(const key of ['bmp180','bmp280']as const)for(const [temperature,pressure]of [[-40,30000],[85,110000]]){
  const c=environmentCircuit(key);Object.assign(c.components[1].properties,{temperature,pressure});
  const r=await done(key,prefix+`s=${key.toUpperCase()}(bus)\nt,p=s.read()\nprint(t,p)\nassert abs(t-(${temperature}))<.11 and abs(p-${pressure})<5`,c);assert(r.frame.measurements.length);
 }
});
test('real AM2320 driver rejects corrupt CRC and observes stale-to-fresh negative/live values',async()=>{
 const corrupted={...files,'lab_i2c_sensors.py':files['lab_i2c_sensors.py'].replace("b = self.bus.readfrom(0x5c, 8)","b = bytearray(self.bus.readfrom(0x5c, 8))\n        b[6] ^= 1")};
 const bad=await done('am2320',prefix+'AM2320(bus).read()',environmentCircuit('am2320'),false,corrupted);assert(bad.events.some((e:any)=>e.message?.includes('CRC16')));
 const c=environmentCircuit('am2320');c.components[1].properties.temperature=-10.1;
 const s=python('am2320',environmentExamples.am2320.code,c);
 try{
  await s.wait((s:Session)=>s.text.includes('T=-10.10 RH=50.00'));
  s.input({component:'am23201',temperature:30,humidity:70});
  await s.wait((s:Session)=>s.text.includes('T=30.00 RH=70.00'));
  assert(frame(s.events).measurements.length>=3);writeFileSync('docs/stage10b-evidence/am2320-live.json',JSON.stringify({console:s.text,measurements:frame(s.events).measurements},null,2)+'\n');
 }finally{assert(await s.stop()<500);}
});
test('MicroPython missing supply/ground/pins/pullups, wrong address and swapped lines produce no false reading',async()=>{
 for(const key of ['bmp180','bmp280','am2320']as const)for(const pin of ['VCC','GND','SDA','SCL','pullups']){
  const c=environmentCircuit(key),id=key+'1';if(pin==='pullups')c.components[1].properties.pullups=false;else c.wires=c.wires.filter(w=>![w.from,w.to].some(e=>e.component===id&&e.pin===pin));
  const r=await done(key,prefix+`${key.toUpperCase()}(bus).read()`,c,false);assert.equal(r.frame.measurements.length,0);
 }
 const wrong=environmentCircuit('bmp280');wrong.components[1].properties.address=0x77;await done('bmp280',prefix+'BMP280(bus).read()',wrong,false);const repaired=await done('bmp280',prefix+'print(BMP280(bus,0x77).read())',wrong);assert(repaired.frame.measurements.length);
 const swapped=environmentCircuit('bmp180');for(const w of swapped.wires)if(['SDA','SCL'].includes(w.to.pin))w.to.pin=w.to.pin==='SDA'?'SCL':'SDA';await done('bmp180',prefix+'BMP180(bus).read()',swapped,false);
});
test('MicroPython four-device shared bus updates OLED from program data, logs pressure and isolates reset',async()=>{
 const s=python('weather');try{
  await s.wait((s:Session)=>s.text.includes('AM2320 T=24.00 RH=50.00')||s.status==='error',12000);assert.notEqual(s.status,'error',JSON.stringify(s.events.filter((e:any)=>e.type==='error')));
  const before=frame(s.events).displays.ssd13061.bytes;assert(before.some(Boolean));
  s.input({component:'bmp2801',temperature:30,pressure:95000});
  await s.wait((s:Session)=>/BMP280 T=30\.00 P=95000/.test(s.text)||s.status==='error',12000);assert.notEqual(s.status,'error',JSON.stringify(s.events.filter((e:any)=>e.type==='error')));assert.notDeepEqual(frame(s.events).displays.ssd13061.bytes,before);
  writeFileSync('docs/stage10b-evidence/micropython-weather.json',JSON.stringify({console:s.text,measurements:frame(s.events).measurements},null,2)+'\n');
 }finally{assert(await s.stop()<500);}
 const fresh=await done('weather',prefix+'print(bus.readfrom_mem(0x76,0xf7,6))');assert.equal(fresh.frame.measurements.length,0);assert(fresh.frame.displays.ssd13061.bytes.every(x=>x===0));
});
test('AM2320 driver measures elapsed time when host sleeps resume 500 us early',async()=>{
 const r=await done('am2320',prefix+`import machine
import lab_i2c_sensors as driver
from time import sleep_us
# Functional clock lock makes the deliberately early wake exact and repeatable.
token=machine.disable_irq()
def early(ms):
    sleep_us(max(0,ms*1000-500))
driver.sleep_ms=early
try:
    sensor=driver.AM2320(bus)
    print("EARLY_WAIT",sensor.read())
finally:
    machine.enable_irq(token)
`);
 assert(r.text.includes('EARLY_WAIT (24.0, 50.0)'),r.text);
 writeFileSync('docs/stage15-evidence/am2320-early-wake.json',JSON.stringify({console:r.text,trace:r.frame.i2cTrace},null,2)+'\n');
});

function openAVR(key:EnvironmentExample,board:typeof UNO|typeof NANO=UNO,edit?:(c:Circuit)=>void){const p=arduinoExampleProject(key,board),c=p.circuit as Circuit;edit?.(c);const a=artifacts[board][key],events:any[]=[],e=new AVREngine(a.hex,compileCircuit(c,'avr'),x=>events.push(x),board===NANO?8:6,a.staticRamBytes);return {e,events};}
function advance(e:AVREngine,ms=100){e.runCycles(ms*16000);e.frame();}
function until(e:AVREngine,events:any[],predicate:()=>boolean,limit=10000){for(let ms=0;ms<limit;ms+=100){advance(e);if(predicate())return;}throw Error('Timeout '+eventsText(events)+' '+JSON.stringify(frame(events)?.diagnostics));}
for(const board of [UNO,NANO]as const)test(`${board}: real compiled weather sketch, register repeated-start, hardware OLED and live environment`,()=>{
 const {e,events}=openAVR('weather',board);const start=performance.now();try{
  until(e,events,()=>eventsText(events).includes('AM2320 T=24.00 RH=50.00'));
  const initial=frame(events);assert(initial.displays.ssd13061.bytes.some(Boolean));assert(initial.i2cTrace.some(t=>t.address===0x77&&t.operation==='R'));assert(initial.i2cTrace.some(t=>t.address===0x76&&t.operation==='R'));assert(events.filter(x=>x.type==='simulation').some(x=>x.avr?.busTrace.some((t:any)=>t.operation==='repeated-start')));
  e.input({component:'bmp1801',temperature:-10,pressure:95000});e.input({component:'bmp2801',temperature:30,pressure:103000});e.input({component:'am23201',temperature:-5,humidity:70});
  until(e,events,()=>eventsText(events).includes('AM2320 T=-5.00 RH=70.00'));
  assert(Math.abs(Number(eventsText(events).match(/BMP180 T=-10.00 P=(\d+)/)?.[1])-95000)<5);assert(Math.abs(Number(eventsText(events).match(/BMP280 T=30.00 P=(\d+)/)?.[1])-103000)<5);
  assert.notDeepEqual(frame(events).displays.ssd13061.bytes,initial.displays.ssd13061.bytes);assert(frame(events).avr!.memory!.minFreeToStatic>500);assert.equal(frame(events).diagnostics.length,0);
  writeFileSync(`docs/stage10b-evidence/${board===UNO?'uno':'nano'}-weather.json`,JSON.stringify({console:eventsText(events),memory:frame(events).avr!.memory,measurements:frame(events).measurements,wallMs:performance.now()-start,virtualMs:e.cpu.cycles/16000},null,2)+'\n');
 }finally{e.dispose();}
});
test('compiled individual Arduino examples run and absent sensor wiring never yields valid measurements',()=>{
 for(const key of ['bmp180','bmp280','am2320']as const){
  const good=openAVR(key);try{until(good.e,good.events,()=>eventsText(good.events).includes(key.toUpperCase()+' T=24.00'));assert(frame(good.events).measurements.length);}finally{good.e.dispose();}
  for(const pin of ['VCC','GND','SDA','SCL','pullups']){
   const bad=openAVR(key,UNO,c=>{if(pin==='pullups')c.components[1].properties.pullups=false;else c.wires=c.wires.filter(w=>w.to.pin!==pin);});try{until(bad.e,bad.events,()=>eventsText(bad.events).includes('nema valjanog mjerenja'));assert.equal(frame(bad.events).measurements.length,0);assert(!eventsText(bad.events).includes(' T=24.00'));}finally{bad.e.dispose();}
  }
 }
});

test('compiled software I2C uses actual GPIO repeated-start, register pointer, ACK and calibration bytes',()=>{
 const {project,artifact}=JSON.parse(readFileSync('verification/stage10b-fixtures.json','utf8')).softwareBmp280;
 const events:any[]=[],e=new AVREngine(artifact.hex,compileCircuit(project.circuit,'avr'),x=>events.push(x));
 try{until(e,events,()=>eventsText(events).includes('CAL=112,107,67,103,24,252,'));assert.match(eventsText(events),/SOFT ACK=1/);assert.match(eventsText(events),/CHIP=88/);assert(frame(events).i2cTrace.some(t=>t.result==='ACK / repeated-start'));assert.equal(frame(events).diagnostics.length,0);}finally{e.dispose();}
});
test('real driver result depends on calibration read from the sensor registers',async()=>{
 const r=await done('bmp280',prefix+'s=BMP280(bus)\ns.c[3]//=2\nt,p=s.read()\nassert abs(p-101325)>1000\nprint("CALIBRATION_USED",p)');assert(r.text.includes('CALIBRATION_USED'));
});
test('production Nano Worker preserves all sensor models, live pressure and a prompt forced Stop',async()=>{
 const manifest=JSON.parse(readFileSync('dist/offline-package.json','utf8')),asset=manifest.files.find((f:any)=>/^\/assets\/avrWorker-.*\.js$/.test(f.url));assert(asset);
 const p=arduinoExampleProject('weather',NANO),a=artifacts[NANO].weather,events:any[]=[];
 const w=new Worker(new URL('./avr-built-worker.mjs',import.meta.url),{workerData:{path:pathToFileURL(resolve('dist'+asset.url)).href}});
 let pending:{check:()=>boolean;ok:()=>void;bad:(e:Error)=>void}|undefined;
 const wait=(check:()=>boolean)=>new Promise<void>((ok,bad)=>{if(check()){ok();return;}const timer=setTimeout(()=>{pending=undefined;bad(Error('Worker timeout: '+eventsText(events)));},15000);pending={check,ok:()=>{clearTimeout(timer);pending=undefined;ok();},bad:e=>{clearTimeout(timer);pending=undefined;bad(e);}};});
 w.on('message',e=>{events.push(e);if(e.type==='error')pending?.bad(Error(e.message));else if(pending?.check())pending.ok();});w.on('error',e=>pending?.bad(e));
 try{
  w.postMessage({type:'run',session:108,hex:a.hex,circuit:compileCircuit(p.circuit as Circuit,'avr'),adcChannels:8,staticRamBytes:a.staticRamBytes});
  await wait(()=>eventsText(events).includes('AM2320 T=24.00 RH=50.00'));
  w.postMessage({type:'input',session:108,component:'bmp2801',pressure:95000,temperature:30});
  await wait(()=>/BMP280 T=30.00 P=95000/.test(eventsText(events)));
  assert.equal(frame(events).avr!.memory!.staticBytes,944);const at=performance.now();await w.terminate();const stopMs=performance.now()-at;assert(stopMs<500);
  writeFileSync('docs/stage10b-evidence/production-worker.json',JSON.stringify({version:manifest.version,build:manifest.build,board:NANO,console:eventsText(events),memory:frame(events).avr!.memory,stopMs,scope:'Node/Linux production bundle, not school PC or iOS'},null,2)+'\n');
 }finally{await w.terminate();}
});

// Regression: a browser timer may return before the nominal fixed wait.
test('BMP180 driver polls SCO after an early wake and times out a stuck conversion',async()=>{
 const code=prefix+`import lab_i2c_sensors as driver
class Bus:
 def __init__(self, real):
  self.real=real
  self.busy=0
  self.polls=0
  self.stuck=False
 def readfrom_mem(self, address, reg, count):
  if reg==0xf4:
   self.polls+=1
   if self.stuck: return b'\\x20'
   self.busy=max(0,self.busy-1)
   return bytes((0x20 if self.busy else 0,))
  if reg==0xf6:
   assert self.busy==0
  return self.real.readfrom_mem(address,reg,count)
 def writeto_mem(self, address, reg, data):
  if reg==0xf4: self.busy=3
  return self.real.writeto_mem(address,reg,data)
b=Bus(bus)
s=driver.BMP180(b)
t,p=s.read()
assert abs(t-24)<.11 and abs(p-101325)<5
assert b.polls>=6
b.stuck=True
try:
 s.read()
 raise AssertionError('missing timeout')
except OSError as e:
 assert 'timeout' in str(e)
print('SCO_AND_TIMEOUT_OK')
`;
 const r=await done('bmp180',code);assert(r.text.includes('SCO_AND_TIMEOUT_OK'));
});
