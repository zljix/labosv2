import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {s3ExampleProject,type S3Example} from '../src/runtime/s3Examples';
import {compileCircuit} from '../src/circuit/compile';
import {createS3Engine} from '../public/s3-engine.mjs';
import {wasmBytes,validateArtifact} from '../public/s3-contract.mjs';
import {libraryManifest,AVR_LIBRARY_FILE} from '../public/avr-contract.mjs';
import {compileS3} from '../scripts/s3-compile.mjs';
const artifacts=JSON.parse(readFileSync('public/s3-examples.json','utf8'));
const dir='docs/stage18b-evidence';mkdirSync(dir,{recursive:true});
const output=(events:any[])=>events.filter(e=>e.type==='console').map(e=>e.text).join('');
const frame=(events:any[])=>events.filter(e=>e.type==='simulation').at(-1);
async function run(key:S3Example,loops=1,edit?:(p:ReturnType<typeof s3ExampleProject>)=>void,action?:(e:any,engine:any)=>void){
 const p=s3ExampleProject(key);edit?.(p);await validateArtifact(p,artifacts[key]);
 const events:any[]=[];let engine:any;engine=await createS3Engine(wasmBytes(artifacts[key].wasm),compileCircuit(p.circuit as any),(e:any)=>{events.push(e);action?.(e,engine);},{fast:true});
 try{await engine.run(loops);const last=frame(events);return {text:output(events),last,events};}finally{engine.stop();}
}
function save(name:string,r:any){const f=structuredClone(r.last);for(const d of Object.values(f.displays??{}) as any[])if(d.bytes)d.bytes={length:d.bytes.length,nonzero:d.bytes.filter(Boolean).length,sha256:createHash('sha256').update(JSON.stringify(d.bytes)).digest('hex')};writeFileSync(dir+'/'+name+'.json',JSON.stringify({console:r.text,frame:f},null,2)+'\n');}
for(const key of ['dht11','dht22'] as const)test('S3 compiled Adafruit '+key+' decodes GPIO pulses with independent known bytes',async()=>{
 const r=await run(key,1,p=>{const d=(p.circuit as any).components.find((d:any)=>d.id==='dht1');d.properties.temperature=key==='dht22'?-12.3:25;d.properties.humidity=key==='dht22'?67.8:50;});
 assert.match(r.text,key==='dht22'?/DHT22 T=-12.3 C RH=67.8/:/DHT11 T=25.0 C RH=50.0/);assert.deepEqual(r.last.timedSensors.dht1.bytes,key==='dht22'?[2,166,128,123,163]:[50,0,25,0,75]);assert.equal(r.last.timedSensors.dht1.sample,1);save(key,r);
});
for(const fault of ['checksum','timeout'] as const)test('S3 DHT rejects '+fault+' and recovers through a new physical transfer',async()=>{
 let changed=false;const r=await run('dht22',2,p=>{(p.circuit as any).components.find((d:any)=>d.id==='dht1').properties.dhtFault=fault;},(e,engine)=>{if(e.type==='console'&&e.text.includes('nevaljano')&&!changed){changed=true;engine.input({component:'dht1',dhtFault:'none',temperature:-12.3,humidity:67.8});}});
 assert(changed);assert.match(r.text,/nevaljano[\s\S]*DHT22 T=-12.3 C RH=67.8/);save('dht-'+fault+'-recovery',r);
});
test('S3 DHT forced 300 ms attempts respect sensor minimum interval',async()=>{const r=await run('dhtErrors',8);assert(r.text.includes('nevaljano'));assert.equal((r.text.match(/DHT22 T=/g)||[]).length,2);assert.equal(r.last.timedSensors.dht1.sample,2);save('dht-throttle',r);});
test('S3 live DHT environment is decoded by the next C++ read',async()=>{let changed=false;const r=await run('dht22',2,undefined,(e,engine)=>{if(e.type==='console'&&e.text.includes('DHT22 T=25.0')&&!changed){changed=true;engine.input({component:'dht1',temperature:32.1,humidity:73.2});}});assert(changed);assert.match(r.text,/25.0[\s\S]*32.1 C RH=73.2/);});
test('S3 DHT with missing external pull-up cannot deliver fabricated data',async()=>{const r=await run('dht22',1,p=>{const c=p.circuit as any;c.wires=c.wires.filter((w:any)=>w.from.component!=='pull0'&&w.to.component!=='pull0');});assert.match(r.text,/nevaljano/);assert.equal(r.last.timedSensors.dht1.sample,0);assert(r.last.diagnostics.some((d:any)=>d.code==='dht-electrical'));});
test('S3 generic OneWire fallback searches three ROMs, matches addresses and decodes signed scratchpads',async()=>{
 const r=await run('ds18Multi');for(const value of ['25.0000','-10.1250','60.0000'])assert(r.text.includes('T='+value),r.text);assert.equal((r.text.match(/ROM=[A-F0-9]{16} T=/g)||[]).length,3);
 assert.equal(new Set(Object.values(r.last.oneWireDevices).map((s:any)=>s.rom)).size,3);for(const s of Object.values(r.last.oneWireDevices) as any[]){assert(s.sample>0);assert(s.trace.some((t:any)=>t.op==='search-complete'||t.type==='search-complete')||JSON.stringify(s.trace).includes('search-complete'));}save('ds18-multi',r);
});
test('S3 DallasTemperature writes and reads all four resolutions with correct quantization',async()=>{const r=await run('ds18Resolution',1,p=>{(p.circuit as any).components.find((d:any)=>d.id==='ds1').properties.temperature=23.5625;});for(const bits of [9,10,11,12])assert(r.text.includes('BITA='+bits),r.text);assert.match(r.text,/BITA=9[\s\S]*T=23.5000/);assert.match(r.text,/BITA=12[\s\S]*T=23.5625/);assert.equal(r.last.oneWireDevices.ds1.resolution,12);save('ds18-resolution',r);});
test('S3 DS18B20 CRC failure affects only the addressed sensor and recovers on a new conversion',async()=>{let changed=false;const r=await run('ds18Multi',2,p=>{(p.circuit as any).components.find((d:any)=>d.id==='ds2').properties.oneWireFault='crc';},(e,engine)=>{if(e.type==='console'&&e.text.includes('nevaljano')&&!changed){changed=true;engine.input({component:'ds2',oneWireFault:'none',temperature:-7.5});}});assert(changed);assert.match(r.text,/nevaljano/);assert.match(r.text,/T=-7.5000/);assert.match(r.text,/T=25.0000/);save('ds18-crc-recovery',r);});
test('S3 DS18B20 disconnected device is absent from ROM search',async()=>{const r=await run('ds18Multi',1,p=>{(p.circuit as any).components.find((d:any)=>d.id==='ds2').properties.oneWireFault='disconnected';});assert.equal((r.text.match(/ROM=[A-F0-9]{16} T=/g)||[]).length,2);assert(!r.text.includes('-10.1250'));});
for(const [key,height] of [['oled64',64],['oled32',32]] as const)test('S3 real U8g2 '+height+'-row library generates I2C page bytes and visible edge pixels',async()=>{const r=await run(key,2);assert.match(r.text,new RegExp('S3 OLED'+height+' COUNT=0[\\s\\S]*COUNT=1'));const d=r.last.displays.display1;assert.equal(d.height,height);assert.equal(d.bytes.length,height*16);assert(d.bytes.some(Boolean));assert(d.bytes[127]&1);assert(d.bytes[(height/8-1)*128+127]&128);assert(r.last.i2cTrace.some((t:any)=>t.address===0x3c));assert.equal(r.last.diagnostics.filter((d:any)=>d.severity==='error').length,0);save(key,r);});
test('S3 U8g2 hardware I2C cannot light an unconnected display',async()=>{const r=await run('oled64',1,p=>{const c=p.circuit as any;c.wires=c.wires.filter((w:any)=>w.to.pin!=='SDA');});assert(!r.last.displays.display1.bytes.some(Boolean));});
test('real S3 compiler rejects unavailable graphics constructors and hardware IRQ API',{skip:!process.env.LAB_WASM_CXX},async()=>{const p=s3ExampleProject('oled64');p.files['main.ino']='#include <U8g2lib.h>\nU8G2_ST7920_128X64_F_SW_SPI o(U8G2_R0,12,11,10);void setup(){}void loop(){}';await assert.rejects(()=>compileS3(p),/st7920/i);p.files[AVR_LIBRARY_FILE]=libraryManifest([]);p.files['main.ino']='void setup(){attachInterrupt(4,0,1);}void loop(){}';await assert.rejects(()=>compileS3(p),/attachInterrupt/);});
