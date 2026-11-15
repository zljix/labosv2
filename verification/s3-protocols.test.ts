import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createElement} from 'react';
import {createHash} from 'node:crypto';
import {renderToStaticMarkup} from 'react-dom/server';
import ComponentHelp from '../src/circuit/ComponentHelp';
import {s3ExampleProject} from '../src/runtime/s3Examples';
import {s3ProtocolExamples} from '../src/runtime/s3ProtocolExamples';
import {compileCircuit} from '../src/circuit/compile';
import {terminals,type Circuit} from '../src/circuit/model';
import {checkCircuit} from '../src/circuit/netlist';
import {parseProject} from '../src/project/model';
import {exportZip,importProject} from '../src/project/archive';
import {exportSketch} from '../src/project/sketch';
import {unzipSync,strFromU8} from 'fflate';
import {S3_BUILD_FILE,validateArtifact,wasmBytes} from '../public/s3-contract.mjs';
import {createS3Engine} from '../public/s3-engine.mjs';
import {compileS3} from '../scripts/s3-compile.mjs';
import {S3} from '../src/boards/profiles';
import {componentSupport,SUPPORT_CATALOG} from '../src/boards/support';
import {supportRows} from '../src/boards/supportReport';
type Key=keyof typeof s3ProtocolExamples;
type P=ReturnType<typeof s3ExampleProject>;
const keys=Object.keys(s3ProtocolExamples) as Key[];
const artifacts=JSON.parse(readFileSync('public/s3-examples.json','utf8'));
const evidence:any[]=[];
const c=(p:P)=>p.circuit as Circuit;
const open=(p:P,id:string,pin:string)=>{c(p).wires=c(p).wires.filter(w=>!(w.to.component===id&&w.to.pin===pin));};
const part=(p:P,id:string)=>c(p).components.find(d=>d.id===id)!;
const close=(a:number,b:number,t=.05)=>assert(Math.abs(a-b)<=t,`${a} != ${b} ± ${t}`);
interface Options {loops?:number;edit?:(p:P)=>void;artifact?:any;setup?:(e:any)=>void;line?:(line:string,frame:any,e:any,marks:any[])=>boolean|void;}
async function run(key:Key,o:Options={}) {
 const p=s3ExampleProject(key);o.edit?.(p);const a=o.artifact??artifacts[key];await validateArtifact(p,a);
 const events:any[]=[],marks:any[]=[];let frame:any,e:any,carry='',done=false;
 e=await createS3Engine(wasmBytes(a.wasm),compileCircuit(c(p)),(v:any)=>{
  events.push(v);if(v.type==='simulation')frame=structuredClone(v);
  if(v.type==='setup-complete')o.setup?.(e);
  if(v.type==='console'){carry+=v.text;let at;while((at=carry.indexOf('\n'))>=0){
   const line=carry.slice(0,at).trim();carry=carry.slice(at+1);marks.push({line,frame:structuredClone(frame)});
   if(o.line?.(line,frame,e,marks)){done=true;queueMicrotask(()=>{e.snapshot();e.stop();});}
  }}
 },{fast:true});
 let error='';const timer=setTimeout(()=>e.stop(),20000);
 try{await e.run(o.loops??1);}catch(x:any){error=x.message;}finally{clearTimeout(timer);e.stop();}
 const text=events.filter(v=>v.type==='console').map(v=>v.text).join('');
 const result={key,text,error,done,frame,marks};evidence.push(result);return result;
}
function summary(f:any){if(!f)return f;const v=structuredClone(f);for(const d of Object.values(v.tfts??{})as any[]){const p=d.pixels;d.pixels={length:p.length,nonzero:p.filter(Boolean).length,sha256:createHash('sha256').update(JSON.stringify(p)).digest('hex'),rgb:p.slice(0,86)};}return v;}
test.after(()=>{mkdirSync('docs/stage22d-evidence',{recursive:true});writeFileSync('docs/stage22d-evidence/s3-protocols-execution.json',JSON.stringify(evidence.map(r=>({...r,frame:summary(r.frame),marks:r.marks.map((m:any)=>({...m,frame:summary(m.frame)}))})),null,2)+'\n');});
const press=(e:any,n:number,cmd=69,hold=0,extra={})=>e.input({component:'irRemote',irPress:n,irCommand:cmd,irHoldMs:hold,...extra});
for(const key of keys)test(`${key}: exact source, drivers, circuit and project/sketch export`,async()=>{
 const p=s3ExampleProject(key);assert.deepEqual(checkCircuit(c(p)).diagnostics,[]);
 p.files[S3_BUILD_FILE]=JSON.stringify(artifacts[key]);
 const q=importProject(exportZip(p),'protocols.zip');assert.deepEqual(q,parseProject(p));await validateArtifact(q,artifacts[key]);
 const files=unzipSync(exportSketch(q));
 for(const [path,source]of Object.entries(q.files).filter(([p])=>/\.(ino|h)$/.test(p)))assert.equal(strFromU8(files['LabSketch/'+(path==='main.ino'?'LabSketch.ino':path)]),source);
});
test('three S3 protocol entries cite executable evidence; only the unconfirmed buzzer stays planned',()=>{
 for(const id of ['ir','bmp280spi','st7735']){assert.equal(componentSupport(SUPPORT_CATALOG.find(x=>x.id===id)!,S3,'arduino-cpp').status,'experimental');assert.match(supportRows().find(r=>r.component===id&&r.target==='s3-cpp')!.evidence,/s3-protocols/);}
 assert.deepEqual(supportRows().filter(r=>r.target==='s3-cpp'&&r.status==='planned').map(r=>r.component).sort(),['buzzer']);
});
test('component help gives S3 pinout, bounded driver and LEDC instead of AVR code',()=>{
 for(const [kind,match]of [['irReceiver',/25 µs/],['irTransmitter',/38000 Hz/],['st7735',/256 B/],['bmp280_spi',/SPI nema ACK/]]as const){const html=renderToStaticMarkup(createElement(ComponentHelp,{kind,boardId:S3,language:'arduino-cpp'}));assert.match(html,match);assert(!html.includes('from machine'));}
});
for(const key of ['irPulses','irNEC']as const)test(`${key}: live full frame and long-press special repeats are decoded in WASM`,async()=>{
 const r=await run(key,{loops:180,setup:e=>press(e,1,70,350)});
 assert.equal(r.error,'');assert.match(r.text,/S3 NEC A=0 C=70 R=0/);assert.equal((r.text.match(/S3 NEC A=0 C=70 R=1/g)??[]).length,3);
 assert.equal(r.frame.infrared.irRemote.presses,1);
 if(key==='irPulses'){const m=r.text.match(/PULSE LEADER=(\d+) MARK=(\d+) SPACE=(\d+)/)!;assert(m);close(+m[1],9000,60);close(+m[2],562.5,60);}
});
test('IR PWM filters addresses, ignores unknown commands and clamps both bounds',async()=>{
 let phase=0;
 const r=await run('irLED',{loops:1200,setup:e=>press(e,1,69,350),line:(l,f,e,marks)=>{
  if(phase===0&&l==='S3 LED=50 R=0'){phase=1;press(e,2,70,1000);}
  else if(phase===1&&marks.filter(m=>m.line==='S3 LED=100 R=1').length===2){phase=2;press(e,3,21,2000);}
  else if(phase===2&&marks.filter(m=>m.line==='S3 LED=0 R=1').length===2){phase=3;press(e,4,69,0,{irAddress:1});press(e,5,99,0,{irAddress:0});press(e,6,70,0);}
  else if(phase===3&&l==='S3 LED=10 R=0')return true;
 }});
 assert.equal(r.error,'');assert(r.done,r.text);assert.equal(r.text.match(/S3 LED=50 R=0/g)?.length,1);
 const tail=r.text.slice(r.text.lastIndexOf('S3 LED=0 R=1'));assert(!tail.includes('LED=50'));assert(!tail.includes('S3 LED=0 R=0'));
 close(r.frame.gpios['7'].duty/65535,25/255,.001);
});
test('bad inverse and timing frames cannot alter LED output; valid frame recovers the decoder',async()=>{
 const r=await run('irLED',{loops:350,setup:e=>{press(e,1,69,0,{irFault:'inverse'});press(e,2,69,0,{irFault:'timing'});press(e,3,70,0,{irFault:'none'});}});
 assert.equal(r.error,'');assert(!r.text.includes('S3 LED=50'));assert.match(r.text,/S3 LED=10 R=0/);
});
for(const option of ['VCC','GND','OUT','blocked','group'])test(`IR ${option}: no fabricated decoded frame`,async()=>{
 const r=await run('irNEC',{loops:100,edit:p=>{if(['VCC','GND','OUT'].includes(option))open(p,'irRx',option);if(option==='blocked')part(p,'irRx').properties.irBlocked=true;if(option==='group')part(p,'irRx').properties.irChannel=2;},setup:e=>press(e,1)});
 assert(!r.text.includes('S3 NEC A='));
 if(option==='OUT'||option==='VCC'||option==='GND')assert.match(r.error,/Nepobuđen|nedefinirana/);else assert.equal(r.error,'');
});
test('LEDC transmitter emits a full NEC envelope and two repeats through the receiver GPIO',async()=>{
 const r=await run('irTransmit');assert.equal(r.error,'');assert.match(r.text,/S3 IR TX A=0 C=69 REPEATS=2/);
 const tx=r.frame.infrared.irTx,rx=r.frame.infrared.irRx;assert.equal(tx.carrierHz,null);assert.equal(rx.transitions,76);
 const tr=rx.trace,leaders=tr.filter((t:any,i:number)=>t.level===0&&tr[i+1]&&tr[i+1].timeUs-t.timeUs>8000);
 assert.equal(leaders.length,3);close(leaders[1].timeUs-leaders[0].timeUs,110000,60);close(leaders[2].timeUs-leaders[1].timeUs,110000,60);
 close(tr[2].timeUs-tr[1].timeUs,9000,10);
 // Decode the sent full frame from its measured spaces, independently of C++.
 const bytes=[0,0,0,0];for(let bit=0;bit<32;bit++){const i=4+bit*2;if(tr[i+1].timeUs-tr[i].timeUs>1000)bytes[bit>>3]|=1<<(bit%8);}
 assert.deepEqual(bytes,[0,255,69,186]);
});
for(const option of ['VCC','GND','SIG','group'])test(`transmitter ${option} cannot deliver an optical waveform`,async()=>{
 const r=await run('irTransmit',{edit:p=>{if(option==='group')part(p,'irTx').properties.irChannel=2;else open(p,'irTx',option);}});assert.equal(r.error,'');assert.equal(r.frame.infrared.irRx.transitions,0);
});
test('real ST7735 program sends red/green/blue, text and geometric pixels',async()=>{
 const r=await run('tftGraphics');assert.equal(r.error,'');assert.match(r.text,/TFT GRAPHICS READY/);
 const d=r.frame.tfts.tft1;assert(d.written>18000);assert.deepEqual([d.pixels[0],d.pixels[42],d.pixels[85]],[0xf800,0x07e0,0x001f]);assert(d.pixels.slice(38*128,64*128).includes(65535));
});
test('all four compiled rotations use the declared panel offsets and physical corners',async()=>{
 const r=await run('tftRotation');assert.equal(r.error,'');
 for(const [rot,index]of [[0,0],[1,127],[2,16383],[3,16256]]){const m=r.marks.find(m=>m.line==='TFT ROT='+rot)!;assert(m);const d=m.frame.tfts.tft1;assert.equal(d.pixels[index],65535);assert.equal(d.pixels.filter((v:number)=>v===0xf800).length,17*17);}
});
for(const pin of ['VCC','GND','SCK','MOSI','CS','DC','RESET'])test(`ST7735 missing ${pin} cannot display program pixels`,async()=>{
 const r=await run('tftGraphics',{edit:p=>open(p,'tft1',pin)});assert.equal(r.error,'');assert.equal(r.frame.tfts.tft1.written,0);
});
test('missing BL hides written RAM; 5 V BL is rejected before simulation',async()=>{
 const r=await run('tftGraphics',{edit:p=>open(p,'tft1','BL')});assert.equal(r.error,'');assert(r.frame.tfts.tft1.written>18000);assert(!r.frame.tfts.tft1.backlight);assert(r.frame.tfts.tft1.pixels.every((p:number)=>p===0));
 const p=s3ExampleProject('tftGraphics');c(p).wires.find(w=>w.to.pin==='BL')!.from.pin=terminals(c(p).components[0]).find(t=>t.role==='5v')!.pin;assert.throws(()=>compileCircuit(c(p)),/BL/);
});
for(const pin of ['VCC','GND','SCK','MOSI','MISO','CS'])test(`BMP280 missing ${pin} fails ID instead of printing a synthetic measurement`,async()=>{
 const r=await run('bmp280SPI',{edit:p=>open(p,'bmpSPI',pin),line:l=>l==='BMP280 SPI ID/SPOJ ERROR'});
 assert.equal(r.error,'');assert(r.done);assert(!r.text.includes('BMP280 SPI T='));
});
test('live shared SPI environment changes compensated data and TFT pixels',async()=>{
 let phase=0,before:number[]=[];
 const r=await run('spiDashboard',{loops:10,line:(l,f,e)=>{
  if(phase===0&&l.includes('SPI DASH T=24.00')){before=f.tfts.tft1.pixels;phase=1;e.input({component:'bmpSPI',temperature:-10,pressure:90000});}
  else if(phase===1&&l.includes('SPI DASH T=-10.00'))return true;
 }});
 assert.equal(r.error,'');assert(r.done,r.text);close(r.frame.sensors.bmpSPI.measuredPressure,90000,2);assert.notDeepEqual(r.frame.tfts.tft1.pixels,before);
});
test('disconnected TFT CS leaves the independent BMP280 path working',async()=>{
 const r=await run('spiDashboard',{edit:p=>open(p,'tft1','CS')});assert.equal(r.error,'');assert.match(r.text,/SPI DASH T=24.00/);assert.equal(r.frame.tfts.tft1.written,0);
});
test('edited driver and source reject the previous build',async()=>{
 for(const key of ['irNEC','tftGraphics','bmp280SPI']as const){const p=s3ExampleProject(key),header=Object.keys(p.files).find(n=>n.endsWith('.h'))!;p.files[header]+='\n// edited\n';await assert.rejects(()=>validateArtifact(p,artifacts[key]),/hash|izvor|odgovara/i);}
});
test('actual compiler changes TFT pixels from modified source and rejects missing NEC header',async()=>{
 const p=s3ExampleProject('tftGraphics');p.files['main.ino']=p.files['main.ino'].replace('42,26,0xf800','42,26,0x001f');const a=await compileS3(p);
 const r=await run('tftGraphics',{edit:q=>{q.files['main.ino']=p.files['main.ino'];},artifact:a});assert.equal(r.error,'');assert.equal(r.frame.tfts.tft1.pixels[0],31);assert.notEqual(a.inputHash,artifacts.tftGraphics.inputHash);
 const q=s3ExampleProject('irNEC');delete q.files['lab_s3_nec.h'];await assert.rejects(()=>compileS3(q),/lab_s3_nec.h.*not found/s);
});
test('actual compiler demonstrates that slow caller polling misses a full IR frame',async()=>{
 const q=s3ExampleProject('irNEC');q.files['main.ino']=q.files['main.ino'].replace('if(ir.read(a,cmd,repeat))','delay(500);if(ir.read(a,cmd,repeat))');const b=await compileS3(q);
 const lost=await run('irNEC',{loops:4,artifact:b,edit:n=>n.files['main.ino']=q.files['main.ino'],setup:e=>press(e,1)});
 assert.equal(lost.error,'');assert(!lost.text.includes('S3 NEC A='));assert.equal(lost.frame.infrared.irRemote.presses,1);
});
test('orphan repeats and repeats older than 150 ms do not create a new command',async()=>{
 for(const [wait,expected]of [[100,0],[200,1]]as const){
  const p=s3ExampleProject('irNEC');
  p.files['main.ino']=p.files['main.ino'].replace('void loop(){','bool first=true;\nvoid loop(){'+(wait===100?'if(first){first=false;delay(100);}':''))
   .replace('delay(1);',wait===200?'delay(200);':'delay(1);');
  const a=await compileS3(p);const r=await run('irNEC',{loops:wait===100?80:5,artifact:a,edit:q=>q.files['main.ino']=p.files['main.ino'],setup:e=>press(e,1,69,700)});
  assert.equal(r.error,'');assert.equal((r.text.match(/S3 NEC A=/g)??[]).length,expected,r.text);
 }
});
test('wrong SPI mode and two active CS cannot fabricate a valid display transfer',async()=>{
 for(const fault of ['mode','select']){
  const p=s3ExampleProject(fault==='mode'?'tftGraphics':'spiDashboard');
  p.files['lab_st7735.h']=fault==='mode'?p.files['lab_st7735.h'].replaceAll('SPI_MODE0','SPI_MODE1'):p.files['lab_st7735.h'].replace('digitalWrite(cs,LOW);','digitalWrite(7,LOW);digitalWrite(cs,LOW);');
  const a=await compileS3(p);const r=await run(fault==='mode'?'tftGraphics':'spiDashboard',{artifact:a,edit:q=>q.files['lab_st7735.h']=p.files['lab_st7735.h']});
  assert.equal(r.frame.tfts.tft1.written,0);assert(r.frame.diagnostics.some((d:any)=>d.code==='spi-protocol'));
 }
});

