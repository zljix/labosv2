import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Worker} from 'node:worker_threads';
import {Session} from '../dist/session.mjs';
import {createHost} from '../public/host.mjs';
import {AHT10,SSD1306} from '../public/peripherals.mjs';
import {compileCircuit} from '../src/circuit/compile';
import {peripheralCircuit,peripheralExample,peripheralDriverNames} from '../src/circuit/peripheralExamples';
import {makePart,parseCircuit,terminals,type Circuit} from '../src/circuit/model';
import {checkCircuit} from '../src/circuit/netlist';
import {newProject,parseProject} from '../src/project/model';
import {exportZip,importProject} from '../src/project/archive';
const machine=await readFile(new URL('../dist/machine.py',import.meta.url),'utf8');
const files=Object.fromEntries(await Promise.all(peripheralDriverNames.map(async p=>[p,await readFile(new URL('../public/drivers/'+p,import.meta.url),'utf8')])));
const factory=()=>{const w=new Worker(new URL('./node-worker.mjs',import.meta.url));const shim:any={postMessage:(d:any)=>w.postMessage(d),terminate:()=>w.terminate()};w.on('message',data=>shim.onmessage?.({data}));w.on('error',error=>shim.onerror?.(error));return shim;};
const open=(c:Circuit,code:string)=>new Session(factory,machine,code,{circuit:compileCircuit(c)},()=>{},files);
const frames=(s:Session)=>s.events.filter((e:any)=>e.type==='simulation') as any[];
const last=(s:Session)=>frames(s).at(-1);
async function done(c:Circuit,code:string,ok=true){const s=open(c,code);try{await s.wait((v:Session)=>['done','error'].includes(v.status));assert.equal(s.status,ok?'done':'error',s.events.map((e:any)=>e.message??'').join('\n'));return {text:s.text,events:s.events,frame:last(s)};}finally{await s.stop();}}
const sensorBus='from machine import I2C,Pin\nfrom time import sleep_ms\nbus=I2C(0,sda=Pin(8),scl=Pin(9),freq=100000)\n';
const oledBus='from machine import I2C,Pin\nbus=I2C(1,sda=Pin(10),scl=Pin(11))\n';
const rewire=(c:Circuit,from:number,to:number)=>{const a=terminals(c.components[0]).find(t=>t.gpio===from)!.pin,b=terminals(c.components[0]).find(t=>t.gpio===to)!.pin;for(const w of c.wires)for(const e of [w.from,w.to])if(e.component==='esp32'&&e.pin===a)e.pin=b;};
const remove=(c:Circuit,id:string,pin:string)=>{c.wires=c.wires.filter(w=>![w.from,w.to].some(e=>e.component===id&&e.pin===pin));};

// Independent protocol bytes and deterministic clock, without Python driver logic.
test('AHT10: startup, calibration, busy, latched 20-bit data and reset',()=>{
 let now=0,jitter=0;const d:any={temperature:25,humidity:50},a=new AHT10(d,()=>{const at=now;now+=jitter;return at;});
 assert.equal(a.read(1)[0],128);now=40;a.write(Uint8Array.of(0xe1,8,0));assert.equal(a.read(1)[0],136);
 now=50;a.write(Uint8Array.of(0xac,0x33,0));d.temperature=40;d.humidity=99;
 now=129;assert(a.read(6)[0]&128);now=130;assert.deepEqual([...a.read(6)],[8,0x80,0,6,0,0]);assert.equal(a.sample,1);
 a.read(6);assert.equal(a.sample,1);a.write(Uint8Array.of(0xba));assert.equal(a.read(1)[0]&8,0);assert.throws(()=>a.read(7),/CRC/);
 now=150;a.write(Uint8Array.of(0xe1,8,0));now=160;a.write(Uint8Array.of(0xac,0x33,0));
 now=239.999;jitter=.002;assert(a.read(6)[0]&128);assert.equal(a.sample,1);assert.equal(a.read(6)[0],8);assert.equal(a.sample,2);
});
test('SSD1306: independent addressing, commands, orientation and no fake text rendering',()=>{
 const d=new SSD1306();d.write(Uint8Array.of(0,0x20,0,0xa1,0xc8,0xaf,0x21,2,3,0x22,0,1));
 d.write(Uint8Array.of(0x40,1,2,4,8));assert.equal(d.ram[2],1);assert.equal(d.ram[3],2);assert.equal(d.ram[130],4);assert.equal(d.ram[131],8);
 assert.equal(d.snapshot(true).bytes[2],1);d.write(Uint8Array.of(0x80,0xa7));assert.equal(d.snapshot(true).bytes[2],254);
 d.write(Uint8Array.of(0,0xa6,0xae));assert(d.snapshot(true).bytes.every((b:number)=>b===0));d.write(Uint8Array.of(0,0xaf));assert(d.snapshot(false).bytes.every((b:number)=>b===0));
 d.write(Uint8Array.of(0,0x20,1,0x21,5,6,0x22,2,3));d.write(Uint8Array.of(0x40,10,11,12,13));assert.equal(d.ram[261],10);assert.equal(d.ram[389],11);assert.equal(d.ram[262],12);assert.equal(d.ram[390],13);
 d.write(Uint8Array.of(0,0x20,2,0xb4,0x01,0x10));d.write(Uint8Array.of(0x40,42));assert.equal(d.ram[513],42);
 assert.throws(()=>d.write(Uint8Array.of(0x80,0x2f)),/podržana/);assert.throws(()=>d.read(),/samo upis/);
});
test('new devices and visible driver files survive project JSON and ZIP',()=>{
 const c=peripheralCircuit();assert.equal(checkCircuit(c).diagnostics.length,0);assert.deepEqual(parseCircuit(c),c);
 const p=newProject(peripheralExample.code,'Periferija');p.circuit=c;p.files={...files,'main.py':peripheralExample.code};
 const zip=importProject(exportZip(p),'test.zip');assert.deepEqual(zip,parseProject(p));assert.equal(Object.keys(zip.files).length,4);
 for(const [id,property,value]of [['aht1','temperature',86],['aht1','humidity',-1],['aht1','pullups','yes'],['oled1','address',0x38]]as const){const bad=structuredClone(c);(bad.components.find(p=>p.id===id)!.properties as any)[property]=value;assert.throws(()=>parseCircuit(bad));}
});
test('real MicroPython: separate scan results, raw six-byte AHT10 protocol and readfrom_into',async()=>{
 const r=await done(peripheralCircuit(),sensorBus+`assert bus.scan()==[0x38]
sleep_ms(40)
bus.writeto(0x38,b'\\xe1\\x08\\x00')
sleep_ms(10)
bus.writeto(0x38,b'\\xac\\x33\\x00')
assert bus.readfrom(0x38,1)[0]&128
sleep_ms(80)
b=bytearray(6)
bus.readfrom_into(0x38,b)
from array import array
words=array('H',[0,0,0])
bus.readfrom_into(0x38,words)
assert bytes(memoryview(words))==bytes(b)
wrapped=bytearray(b'xxxxxxxxxx')
bus.readfrom_into(0x38,memoryview(wrapped)[2:8])
assert wrapped[:2]==b'xx' and wrapped[2:8]==b and wrapped[8:]==b'xx'
h=((b[1]<<12)|(b[2]<<4)|(b[3]>>4))*100/1048576
t=(((b[3]&15)<<16)|(b[4]<<8)|b[5])*200/1048576-50
assert abs(t-24)<0.001 and abs(h-50)<0.001
other=I2C(1,sda=Pin(10),scl=Pin(11))
assert other.scan()==[0x3c]
print('PROTOCOL_OK')`);assert(r.text.includes('PROTOCOL_OK'));assert.equal(r.frame.measurements.length,1);
});
test('integrated Python drivers: live environment -> measured bytes -> OLED pixels -> servo with hysteresis',async()=>{
 const c=peripheralCircuit(),s=open(c,peripheralExample.code);
 try{
  await s.wait((v:Session)=>frames(v).some(f=>f.servos.servo1.angle!==null&&f.servos.servo1.angle<.1&&f.measurements.length));
  const first=last(s).displays.oled1.bytes;assert(first.some((b:number)=>b));
  s.input({component:'aht1',temperature:30,humidity:70});
  await s.wait((v:Session)=>frames(v).some(f=>f.servos.servo1.angle>89&&f.servos.servo1.angle<91&&f.sensors.aht1.measuredHumidity>69));
  assert.notDeepEqual(last(s).displays.oled1.bytes,first);
  s.input({component:'aht1',temperature:27});await s.wait((v:Session)=>frames(v).some(f=>Math.abs(f.sensors.aht1.measuredTemperature-27)<.01));assert(Math.abs(last(s).servos.servo1.angle-90)<.1);
  s.input({component:'aht1',temperature:25});await s.wait((v:Session)=>frames(v).some(f=>f.measurements.length>=4&&f.servos.servo1.angle<.1));assert.equal(s.status,'running');assert(s.text.includes('servo=90'));
 }finally{await s.stop();}
});
test('wrong I2C pins, swapped lines, absent VCC and ground produce NACK; repairs restore real driver',async()=>{
 for(const pin of ['VCC','GND','SDA','SCL']){
  const c=peripheralCircuit();remove(c,'aht1',pin);const r=await done(c,sensorBus+"from aht10 import AHT10\nAHT10(bus).read()",false);assert(r.events.some((e:any)=>e.message?.includes('OSError')));assert(r.frame.diagnostics.some((d:any)=>d.code==='i2c-transfer'));
 }
 const swapped=peripheralCircuit();for(const w of swapped.wires)for(const e of [w.from,w.to])if(e.component==='aht1'&&['SDA','SCL'].includes(e.pin))e.pin=e.pin==='SDA'?'SCL':'SDA';
 await done(swapped,sensorBus+'bus.readfrom(0x38,1)',false);
 await done(peripheralCircuit(),sensorBus+'from aht10 import AHT10\nprint(AHT10(bus).read())');
});
test('OLED wrong address and missing power fail; setting module and code to 0x3D restores display',async()=>{
 const c=peripheralCircuit();c.components.find(p=>p.id==='oled1')!.properties.address=0x3d;
 await done(c,oledBus+'from ssd1306 import SSD1306_I2C\nSSD1306_I2C(128,64,bus)',false);
 const r=await done(c,oledBus+"from ssd1306 import SSD1306_I2C\nd=SSD1306_I2C(128,64,bus,addr=0x3d)\nd.pixel(7,9,1)\nd.show()");assert.equal(r.frame.displays.oled1.bytes[135],2);
 remove(c,'oled1','VCC');await done(c,oledBus+'bus.writeto(0x3d,b"\\x00\\xaf")',false);
});
test('module pull-ups are electrical paths; absent pull-ups fail, two external resistors restore bus',async()=>{
 const c=peripheralCircuit();c.components.find(p=>p.id==='aht1')!.properties.pullups=false;
 await done(c,sensorBus+'bus.readfrom(0x38,1)',false);
 for(const [i,pin]of ['SDA','SCL'].entries()){
  const id='pull'+i,p=makePart('resistor',500+i*150,50,id);p.properties.resistance=4700;c.components.push(p);
  c.wires.push({id:id+'a',from:{component:id,pin:'1'},to:{component:'aht1',pin},color:'#087f8c',points:[]},{id:id+'b',from:{component:id,pin:'2'},to:{component:'esp32',pin:'J1.1'},color:'#d04b46',points:[]});
 }
 const r=await done(c,sensorBus+"assert bus.scan()==[0x38]\nprint('PULL_OK')");assert(r.text.includes('PULL_OK'));
});
test('rewiring and renaming components uses actual nets and GPIO, without fixed fixture fallbacks',async()=>{
 const c=peripheralCircuit();rewire(c,8,12);rewire(c,9,13);
 await done(c,sensorBus+'bus.readfrom(0x38,1)',false);
 const old='aht1',id='newSensor';c.components.find(p=>p.id===old)!.id=id;for(const w of c.wires)for(const e of [w.from,w.to])if(e.component===old)e.component=id;
 const r=await done(c,sensorBus.replace('Pin(8)','Pin(12)').replace('Pin(9)','Pin(13)')+'from aht10 import AHT10\nprint(AHT10(bus).read())');assert.equal(r.frame.measurements[0].component,id);
});
test('servo follows PWM pulse: 0/90/180, power/ground/signal, unsupported period and deinit',async()=>{
 for(const [us,angle]of [[500,0],[1500,90],[2500,180]]){
  const r=await done(peripheralCircuit(),`from machine import PWM,Pin\np=PWM(Pin(4),freq=50,duty_ns=${us*1000})`);assert(Math.abs(r.frame.servos.servo1.angle-angle)<.1);
 }
 for(const pin of ['V+','GND','SIG']){const c=peripheralCircuit();remove(c,'servo1',pin);const r=await done(c,'from machine import PWM,Pin\nPWM(Pin(4),freq=50,duty_ns=1500000)');assert.equal(r.frame.servos.servo1.angle,null);}
 for(const code of ['PWM(Pin(4),freq=100,duty_ns=1500000)','PWM(Pin(4),freq=50,duty_ns=3000000)','p=PWM(Pin(4),freq=50,duty_ns=1500000)\np.deinit()']){const r=await done(peripheralCircuit(),'from machine import PWM,Pin\n'+code);assert.equal(r.frame.servos.servo1.angle,null);}
});
test('SSD1306 standard driver: writevto, text/graphics, inversion, power, contrast, rotate',async()=>{
 const r=await done(peripheralCircuit(),oledBus+`from ssd1306 import SSD1306_I2C
d=SSD1306_I2C(128,64,bus)
d.fill(0)
d.pixel(1,2,1)
d.show()
d.invert(1)
assert bus.writevto(0x3c,[b'',b'\\x80',memoryview(b'\\xaf')])==2
d.contrast(42)
print('OLED_OK')`);assert(r.text.includes('OLED_OK'));assert.equal(r.frame.displays.oled1.bytes[1],251);assert.equal(r.frame.displays.oled1.contrast,42);
 const off=await done(peripheralCircuit(),oledBus+'from ssd1306 import SSD1306_I2C\nd=SSD1306_I2C(128,64,bus)\nd.fill(1)\nd.show()\nd.poweroff()');assert(off.frame.displays.oled1.bytes.every((b:number)=>b===0));
 const rot=await done(peripheralCircuit(),oledBus+'from ssd1306 import SSD1306_I2C\nd=SSD1306_I2C(128,64,bus)\nd.pixel(1,2,1)\nd.show()\nd.rotate(False)');assert.equal(rot.frame.displays.oled1.bytes[126+7*128],32);
});
test('two OLED addresses are isolated; duplicate address, AHT10 sharing and 5 V module are diagnosed',async()=>{
 const c=peripheralCircuit(),d=makePart('ssd1306',1000,500,'oled2');d.properties.address=0x3d;c.components.push(d);
 for(const pin of ['VCC','GND','SDA','SCL'])c.wires.push({id:'second'+pin,from:{component:'oled1',pin},to:{component:'oled2',pin},color:'#087f8c',points:[]});
 const r=await done(c,oledBus+'from ssd1306 import SSD1306_I2C\na=SSD1306_I2C(128,64,bus)\nb=SSD1306_I2C(128,64,bus,addr=0x3d)\na.pixel(1,1,1)\na.show()\nb.pixel(2,2,1)\nb.show()');assert.equal(r.frame.displays.oled1.bytes[1],2);assert.equal(r.frame.displays.oled2.bytes[2],4);assert.equal(r.frame.displays.oled2.bytes[1],0);
 c.components.find(p=>p.id==='oled2')!.properties.address=0x3c;assert.throws(()=>compileCircuit(c),/adresu/);
 const shared=peripheralCircuit();for(const pin of ['SDA','SCL'])shared.wires.push({id:'shared'+pin,from:{component:'aht1',pin},to:{component:'oled1',pin},color:'#087f8c',points:[]});assert.throws(()=>compileCircuit(shared),/zasebnu/);
 const over=peripheralCircuit();over.wires.find(w=>w.to.component==='aht1'&&w.to.pin==='VCC')!.from.pin='J1.21';assert.throws(()=>compileCircuit(over),/5 V/);
});
test('I2C declared bounds, unsupported commands and STOP are catchable Python exceptions',async()=>{
 const r=await done(peripheralCircuit(),sensorBus+`for action in (lambda:bus.readfrom(0x38,-1),lambda:bus.writeto(128,b''),lambda:bus.writevto(0x38,[b'x'*4097])):
 try:
  action()
  raise AssertionError('Expected ValueError')
 except ValueError:
  pass
assert len(bus.readfrom(0x38,1,False)) == 1
bus.deinit()
try:
 bus.scan()
 raise AssertionError('Expected OSError')
except OSError:
 pass
print('BOUNDS_OK')`);assert(r.text.includes('BOUNDS_OK'));
 const bad=await done(peripheralCircuit(),oledBus+'bus.writeto(0x3c,b"\\x80\\x2f")',false);assert(bad.events.some((e:any)=>e.message?.includes('NotImplementedError')));
});
test('trace/history are bounded; new run clears peripheral state and Stop isolates pending work',async()=>{
 const r=await done(peripheralCircuit(),oledBus+'for i in range(130):\n bus.writeto(0x3c,b"\\x80\\xaf")');assert.equal(r.frame.i2cTrace.length,100);
 const c=peripheralCircuit(),s=open(c,peripheralExample.code);await s.wait((v:Session)=>frames(v).some(f=>f.measurements.length));s.input({component:'aht1',temperature:70});assert(await s.stop()<500);const n=s.events.length;
 const fresh=await done(c,sensorBus+'print(bus.scan())');assert.equal(fresh.frame.measurements.length,0);assert(fresh.frame.displays.oled1.bytes.every((b:number)=>b===0));assert.equal(fresh.frame.servos.servo1.angle,null);assert.equal(fresh.frame.sensors.aht1.temperature,24);assert.equal(s.events.length,n);
});

test('program-controlled sensor power removes ACK, resets calibration and permits recovery',async()=>{
 const c=peripheralCircuit(),power=terminals(c.components[0]).find(t=>t.gpio===6)!.pin;
 c.wires.find(w=>w.to.component==='aht1'&&w.to.pin==='VCC')!.from.pin=power;
 const r=await done(c,'from machine import Pin\npower=Pin(6,Pin.OUT,value=1)\n'+sensorBus+`from aht10 import AHT10
sensor=AHT10(bus)
sensor.read()
power.off()
assert bus.scan()==[]
power.on()
sleep_ms(40)
assert bus.readfrom(0x38,1)[0]&8==0
sensor=AHT10(bus)
sensor.read()
print('POWER_RECOVERY_OK')`);assert(r.text.includes('POWER_RECOVERY_OK'));assert.equal(r.frame.measurements.length,2);
});

test('205 real conversions retain the last 200 samples and 100 I2C transactions',async()=>{
 const s=open(peripheralCircuit(),sensorBus+`from aht10 import AHT10
sensor=AHT10(bus)
for i in range(205):
 sensor.read()
print('BUFFER_LIMIT_OK')`);
 try{await s.wait((v:Session)=>['done','error'].includes(v.status),30000);assert.equal(s.status,'done',s.text);assert(s.text.includes('BUFFER_LIMIT_OK'));
  const f=last(s);assert.equal(f.measurements.length,200);assert.equal(f.measurements[0].sample,6);assert.equal(f.measurements.at(-1).sample,205);assert.equal(f.i2cTrace.length,100);
 }finally{await s.stop();}
});
