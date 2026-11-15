import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {s3ExampleProject} from '../src/runtime/s3Examples';
import {s3CompletionExamples} from '../src/runtime/s3CompletionExamples';
import {compileCircuit} from '../src/circuit/compile';
import type {Circuit} from '../src/circuit/model';
import {checkCircuit} from '../src/circuit/netlist';
import {parseProject} from '../src/project/model';
import {exportZip,importProject} from '../src/project/archive';
import {exportSketch} from '../src/project/sketch';
import {unzipSync,strFromU8} from 'fflate';
import {S3_BUILD_FILE,validateArtifact,wasmBytes} from '../public/s3-contract.mjs';
import {createS3Engine} from '../public/s3-engine.mjs';
import {ursLessons,ursTargets,variantAvailable} from '../src/lessons/ursCatalog';
type Key=keyof typeof s3CompletionExamples;type P=ReturnType<typeof s3ExampleProject>;
const artifacts=JSON.parse(readFileSync('public/s3-examples.json','utf8')),evidence:any[]=[];
function digestFrame(f:any){if(!f)return f;const v=structuredClone(f);for(const d of Object.values(v.tfts??{})as any[]){const p=d.pixels;d.pixels={length:p.length,nonzero:p.filter(Boolean).length,sha256:createHash('sha256').update(JSON.stringify(p)).digest('hex'),corners:[p[0],p[239],p.at(-240),p.at(-1)]};}return v;}
interface Opt {loops?:number;edit?:(p:P)=>void;setup?:(e:any)=>void;line?:(l:string,f:any,e:any,marks:any[])=>boolean|void;}
async function run(key:Key,o:Opt={}){
 const p=s3ExampleProject(key);o.edit?.(p);await validateArtifact(p,artifacts[key]);
 let e:any,frame:any,carry='',text='',error='',done=false;const marks:any[]=[];
 e=await createS3Engine(wasmBytes(artifacts[key].wasm),compileCircuit(p.circuit as Circuit),(v:any)=>{
  if(v.type==='simulation')frame=structuredClone(v);
  if(v.type==='setup-complete')o.setup?.(e);
  if(v.type==='console'){text+=v.text;carry+=v.text;let at;while((at=carry.indexOf('\n'))>=0){const l=carry.slice(0,at).trim();carry=carry.slice(at+1);marks.push({line:l,frame:structuredClone(frame)});if(o.line?.(l,frame,e,marks)){done=true;queueMicrotask(()=>{e.snapshot();e.stop();});}}}
 },{fast:true});
 const timer=setTimeout(()=>e.stop(),15000);try{await e.run(o.loops??1);}catch(x:any){error=x.message;}finally{clearTimeout(timer);e.stop();}
 const result={key,text,error,done,frame,marks};evidence.push({...result,frame:digestFrame(frame),marks:marks.map(m=>({...m,frame:digestFrame(m.frame)}))});return result;
}
test.after(()=>{mkdirSync('docs/stage22e-evidence',{recursive:true});writeFileSync('docs/stage22e-evidence/s3-completion-execution.json',JSON.stringify(evidence,null,2)+'\n');});
const open=(p:P,id:string,pin:string)=>{const c=p.circuit as Circuit;c.wires=c.wires.filter(w=>!(w.to.component===id&&w.to.pin===pin));};
test('67 variants in all four targets give 268 executable URS routes',()=>{
 assert.equal(ursLessons.flatMap(l=>l.variants).length,67);
 for(const t of Object.keys(ursTargets)as (keyof typeof ursTargets)[])assert.equal(ursLessons.flatMap(l=>l.variants).filter(v=>variantAvailable(v,t)).length,67);
});
for(const key of Object.keys(s3CompletionExamples)as Key[])test(`${key}: separate exact source, netlist, artifact and project/sketch round trip`,async()=>{
 const p=s3ExampleProject(key);assert.deepEqual(checkCircuit(p.circuit as Circuit).diagnostics,[]);p.files[S3_BUILD_FILE]=JSON.stringify(artifacts[key]);
 const q=importProject(exportZip(p),'completion.zip');assert.deepEqual(q,parseProject(p));await validateArtifact(q,artifacts[key]);
 const files=unzipSync(exportSketch(q));for(const [name,source]of Object.entries(q.files).filter(([n])=>/\.(ino|h)$/.test(n)))assert.equal(strFromU8(files['LabSketch/'+(name==='main.ino'?'LabSketch.ino':name)]),source);
});
for(const key of ['bmp180','bmp280','am2320']as const)test(`${key}: compiled I2C driver responds to live environment with documented freshness`,async()=>{
 let phase=0;const r=await run(key,{loops:8,line:(l,f,e)=>{
  if(phase===0&&l.includes(key.toUpperCase()+' T=')){phase=1;e.input({component:key+'1',temperature:key==='am2320'?31.2:-10,...(key==='am2320'?{humidity:67.8}:{pressure:90000})});}
  else if(phase===1&&l.includes(key==='am2320'?'T=31.20 RH=67.80':'T=-10.00 P='))return true;
 }});
 assert.equal(r.error,'');assert(r.done,r.text);
});
for(const key of ['bmp180','bmp280','am2320']as const)test(`${key}: missing SDA cannot print a valid measurement`,async()=>{
 const r=await run(key,{edit:p=>open(p,key+'1','SDA')});assert.equal(r.error,'');assert(!r.text.includes(' T='));assert.match(r.text,/provjeri|nema valjanog/);
});
test('DS18B20 explicitly distinguishes initial, early and completed registers',async()=>{
 const r=await run('ds18Errors');assert.equal(r.error,'');assert.match(r.text,/STARI REGISTAR.*T=85\.0000/s);assert.match(r.text,/PRIJE DOVRSETKA.*T=85\.0000/s);assert.match(r.text,/NAKON CEKANJA.*T=25\.0000/s);
});
test('DS18B20 CRC fault is invalid data and recovery returns a fresh sample',async()=>{
 let phase=0;const r=await run('ds18Errors',{loops:8,setup:e=>e.input({component:'ds1',oneWireFault:'crc'}),line:(l,f,e)=>{
  if(phase===0&&l.includes('CRC ili odspojen')){phase=1;e.input({component:'ds1',oneWireFault:'none',temperature:-10.125});}
  else if(phase===1&&l.includes('NAKON CEKANJA')&&l.includes('-10.1250'))return true;
 }});
 assert.equal(r.error,'');assert(r.done,r.text);assert(!r.text.includes('T=0.0000'));
});
test('TM1637 sends all eight segment bits and ACKs through GPIO',async()=>{
 const r=await run('tmSegments');assert.equal(r.error,'');for(let i=0;i<8;i++)assert(r.text.includes('TM SEGMENT bit='+i));assert(!r.text.includes('ACK ERROR'));assert.equal(r.frame.tmDisplays.tm1.bytes[1],128);
});
test('TM1637 software clock renders 12:34 and then 12:35, with colon gating',async()=>{
 const r=await run('tmClock',{loops:2});assert.equal(r.error,'');assert.match(r.text,/TM CLOCK=12:34/);assert.match(r.text,/TM CLOCK=12:35/);assert(!r.text.includes('ACK ERROR'));
});
test('TM1637 open CLK cannot pretend that segment transfer succeeded',async()=>{
 const r=await run('tmSegments',{edit:p=>open(p,'tm1','CLK')});assert.equal(r.error,'');assert.match(r.text,/TM ACK ERROR/);
});
test('ILI9341 compiled geometry writes RGB565 and the bottom-right 16-bit addressed pixel',async()=>{
 const r=await run('iliGraphics');assert.equal(r.error,'');const p=r.frame.tfts.tft1.pixels;assert.deepEqual([p[0],p[80],p[160],p.at(-1)],[0xf800,0x07e0,0x001f,0xf81f]);assert.match(r.text,/ILI GRAPHICS READY/);
});
test('ILI9341 four rotations preserve the corresponding physical corner and logical dimensions',async()=>{
 const r=await run('iliRotation');assert.equal(r.error,'');for(let i=0;i<4;i++)assert(r.text.includes('ILI ROT='+i+' '+(i%2?'320x240':'240x320')));assert.equal(r.frame.tfts.tft1.pixels[320*240-240],65535);
});
test('raw XPT2046 data follows live press, drag and release through SPI',async()=>{
 let phase=0;const r=await run('touchRaw',{loops:20,line:(l,f,e)=>{
  if(phase===0&&l.includes('TOUCH RAW')){phase=1;e.input({component:'touch1',touchDown:true,touchX:239,touchY:319,touchPressure:100});}
  else if(phase===1&&l.includes('X=3900 Y=3850 Z1=2000 Z2=2595 IRQ=0')){phase=2;e.input({component:'touch1',touchDown:false});}
  else if(phase===2&&l.includes('Z1=0 Z2=4095 IRQ=1'))return true;
 }});
 assert.equal(r.error,'');assert(r.done,r.text);
});
test('two-point calibration computes endpoints in the program and maps a later center press',async()=>{
 let phase=0;const timers:any[]=[];
 const r=await run('touchCalibration',{loops:100,line:(l,f,e)=>{
  if(l==='CAL TARGET 20 20'){phase=1;e.input({component:'touch1',touchDown:true,touchX:20,touchY:20,touchPressure:50});timers.push(setTimeout(()=>e.input({component:'touch1',touchDown:false}),10));}
  else if(l==='CAL TARGET 219 299'){phase=2;e.input({component:'touch1',touchDown:true,touchX:219,touchY:299,touchPressure:50});timers.push(setTimeout(()=>e.input({component:'touch1',touchDown:false}),10));}
  else if(phase===2&&l.startsWith('CAL READY ')){phase=3;e.input({component:'touch1',touchDown:true,touchX:120,touchY:160,touchPressure:50});}
  else if(phase===3&&l.startsWith('CAL POINT '))return true;
 }});
 for(const t of timers)clearTimeout(t);assert.equal(r.error,'');assert(r.done,r.text);const p=r.text.match(/CAL POINT (\d+) (\d+)/)!;assert(Math.abs(+p[1]-120)<=1&&Math.abs(+p[2]-160)<=1,r.text);
});
test('touch rotations require release between presses and map the same physical point in four ways',async()=>{
 let phase=0;const timers:any[]=[];
 const r=await run('touchRotation',{loops:2000,line:(l,f,e,marks)=>{
  if(l==='TOUCH ROT READY')e.input({component:'touch1',touchDown:true,touchX:60,touchY:80,touchPressure:50});
  else if(l.startsWith('TOUCH ROT=')){
   phase++;if(phase===4)return true;
   e.input({component:'touch1',touchDown:false});
   // Wait through the next full screen draw so the polling loop observes release.
   timers.push(setTimeout(()=>e.input({component:'touch1',touchDown:true,touchX:60,touchY:80,touchPressure:50}),150));
  }
 }});
 for(const t of timers)clearTimeout(t);assert.equal(r.error,'');assert(r.done,r.text);assert.equal((r.text.match(/TOUCH ROT=/g)??[]).length,4);
 for(const [rot,x,y]of [[0,60,80],[1,80,179],[2,179,239],[3,239,60]]){const m=r.text.match(new RegExp('ROT='+rot+' X=(\\d+) Y=(\\d+)'))!;assert(m,r.text);assert(Math.abs(+m[1]-x)<=1&&Math.abs(+m[2]-y)<=1,r.text);}
});
test('touch missing MISO cannot produce a calibrated point',async()=>{
 const r=await run('touchRotation',{loops:4,edit:p=>open(p,'touch1','MISO'),setup:e=>e.input({component:'touch1',touchDown:true,touchX:120,touchY:160,touchPressure:50})});assert.equal(r.error,'');assert(!r.text.includes('TOUCH ROT='));assert(r.frame.diagnostics.some((d:any)=>d.message.includes('MISO')));
});

