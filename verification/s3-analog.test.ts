import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {s3ExampleProject} from '../src/runtime/s3Examples';
import {s3AnalogExamples} from '../src/runtime/s3AnalogExamples';
import {compileCircuit} from '../src/circuit/compile';
import type {Circuit} from '../src/circuit/model';
import {checkCircuit} from '../src/circuit/netlist';
import {parseProject} from '../src/project/model';
import {exportZip,importProject} from '../src/project/archive';
import {exportSketch} from '../src/project/sketch';
import {unzipSync,strFromU8} from 'fflate';
import {S3_BUILD_FILE,validateArtifact,wasmBytes} from '../public/s3-contract.mjs';
import {createS3Engine} from '../public/s3-engine.mjs';
import {compileS3} from '../scripts/s3-compile.mjs';
import {componentSupport,SUPPORT_CATALOG} from '../src/boards/support';
import {supportRows} from '../src/boards/supportReport';

type Key=keyof typeof s3AnalogExamples;
const keys=Object.keys(s3AnalogExamples) as Key[];
const artifacts=JSON.parse(readFileSync('public/s3-examples.json','utf8'));
const evidence:any[]=[];
const c=(p:ReturnType<typeof s3ExampleProject>)=>p.circuit as Circuit;
const number=(line:string,name:string)=>Number(line.match(new RegExp('(?:^| )'+name+'=(-?[0-9.]+|nan)'))?.[1]);
const close=(actual:number,expected:number,tolerance=.06)=>assert(Math.abs(actual-expected)<=tolerance,`${actual} != ${expected} ± ${tolerance}`);
async function run(key:Key,loops=1,edit?:(p:ReturnType<typeof s3ExampleProject>)=>void,action?:(engine:any,index:number,line:string)=>void,artifact=artifacts[key]) {
 const p=s3ExampleProject(key);edit?.(p);await validateArtifact(p,artifact);
 const events:any[]=[];let engine:any,index=0,carry='';
 engine=await createS3Engine(wasmBytes(artifact.wasm),compileCircuit(c(p)),(event:any)=>{
  events.push(event);
  if(event.type==='console'){
   carry+=event.text;let end;
   while((end=carry.indexOf('\n'))>=0){const line=carry.slice(0,end).trim();carry=carry.slice(end+1);if(line.startsWith('S3 '))action?.(engine,index++,line);}
  }
 },{fast:true});
 let error='';
 try{await engine.run(loops);}catch(e:any){error=e.message;}finally{engine.stop();}
 const text=events.filter(e=>e.type==='console').map(e=>e.text).join('');
 const frame=events.filter(e=>e.type==='simulation').at(-1);
 evidence.push({key,loops,text,error,analogInputs:frame?.analogInputs,diagnostics:frame?.diagnostics});
 return {text,lines:text.split(/\r?\n/).filter((s:string)=>s.startsWith('S3 ')),frame,error};
}
test.after(()=>{mkdirSync('docs/stage22b-evidence',{recursive:true});writeFileSync('docs/stage22b-evidence/s3-analog-execution.json',JSON.stringify(evidence,null,2)+'\n');});

for(const key of keys)test(`${key}: exact source/header, valid nets, ZIP and physical sketch export`,async()=>{
 const p=s3ExampleProject(key);assert.equal(checkCircuit(c(p)).diagnostics.length,0);
 p.files[S3_BUILD_FILE]=JSON.stringify(artifacts[key]);
 const q=importProject(exportZip(p),'s3-analog.zip');assert.deepEqual(q,parseProject(p));await validateArtifact(q,artifacts[key]);
 const sketch=unzipSync(exportSketch(q));assert.equal(strFromU8(sketch['LabSketch/LabSketch.ino']),q.files['main.ino']);assert.equal(strFromU8(sketch['LabSketch/lab_analog.h']),q.files['lab_analog.h']);
});

test('matrix declares six experimental S3 profiles, URS04 coverage and actual evidence',()=>{
 for(const id of ['lm35','temt6000','ntc','ky023','flame','sound']){
  const p=s3ExampleProject(id as Key),item=SUPPORT_CATALOG.find(i=>i.id===id)!;
  assert.equal(componentSupport(item,p.board.id,p.language).status,'experimental');
  const row=supportRows().find(r=>r.component===id&&r.target==='s3-cpp')!;assert.deepEqual(row.exercises,['URS04']);assert.match(row.evidence,/s3-analog.test.ts/);
 }
});
for(const temperature of [2,25,50,100,150])test(`compiled LM35 converts the 10 mV/C circuit at ${temperature} C`,async()=>{
 const r=await run('lm35',1,p=>{c(p).components.find(d=>d.id==='lm351')!.properties.temperature=temperature;});assert.equal(r.error,'');
 close(number(r.lines[0],'T'),temperature);close(number(r.lines[0],'U'),temperature*.01,.001);
 assert.equal(number(r.lines[0],'ADC'),Math.round(temperature*.01*4095/3.1));
});
test('LM35 live input changes the next actual C++ ADC result',async()=>{
 const r=await run('lm35',3,undefined,(e,i)=>{if(i===0)e.input({component:'lm351',temperature:75});if(i===1)e.input({component:'lm351',temperature:10});});
 assert.equal(r.error,'');assert.equal(r.lines.length,3);[25,75,10].forEach((t,i)=>close(number(r.lines[i],'T'),t));
});
for(const illuminance of [0,20,100,600,2000])test(`compiled TEMT6000 reads network voltage, ${illuminance} lx stimulus`,async()=>{
 const r=await run('temt6000',1,p=>{c(p).components.find(d=>d.id==='temt60001')!.properties.illuminance=illuminance;});assert.equal(r.error,'');
 const voltage=Math.min(3.2,illuminance*.005),raw=Math.round(Math.min(3.1,voltage)*4095/3.1);
 assert.equal(number(r.lines[0],'ADC'),raw);close(number(r.lines[0],'U'),Math.min(3.1,voltage),.001);assert.equal(number(r.lines[0],'SAT'),voltage>=3.1?1:0);
 assert(!r.text.includes('LUX='));
});
for(const temperature of [-20,0,25,50,100])test(`compiled NTC uses the 3.3 V divider, ${temperature} C`,async()=>{
 const r=await run('ntc',1,p=>{c(p).components.find(d=>d.id==='ntc1')!.properties.temperature=temperature;});assert.equal(r.error,'');close(number(r.lines[0],'T'),temperature,.2);
});
test('NTC rejects actual ADC saturation instead of displaying a fabricated temperature',async()=>{
 const r=await run('ntc',1,p=>{const d=c(p).components.find(d=>d.id==='ntc1')!;d.properties.fixedResistance=100;});
 assert.equal(r.error,'');assert.equal(number(r.lines[0],'ADC'),4095);assert(Number.isNaN(number(r.lines[0],'T')));assert.match(r.text,/NTC GRANICA/);
});
test('NTC changed resistance really changes the measured result until source constants are adjusted',async()=>{
 const r=await run('ntc',1,p=>{c(p).components.find(d=>d.id==='ntc1')!.properties.r25=20000;});assert.equal(r.error,'');close(number(r.lines[0],'T'),10.18,.2);
});
test('LM35 and NTC share the ADC but respond independently while running',async()=>{
 const r=await run('analogCompare',3,undefined,(e,i)=>{if(i===0)e.input({component:'lm351',temperature:50});if(i===1)e.input({component:'ntc1',temperature:50});});
 assert.equal(r.error,'');assert.equal(r.lines.length,3);
 for(const [i,a,b]of [[0,25,25],[1,50,25],[2,50,50]]){close(number(r.lines[i],'LM35'),a);close(number(r.lines[i],'NTC'),b,.15);}
});
test('KY-023 center, both signs, dead zone, upper clipping and active LOW button execute in C++',async()=>{
 const r=await run('ky023',4,undefined,(e,i)=>{
  if(i===0)e.input({component:'ky0231',axisX:51,axisY:49});
  if(i===1)e.input({component:'ky0231',axisX:100,axisY:0,pressed:true});
  if(i===2)e.input({component:'ky0231',axisX:0,axisY:100,pressed:false});
 });assert.equal(r.error,'');assert.equal(r.lines.length,4);
 for(const i of [0,1]){assert.equal(number(r.lines[i],'NX'),0);assert.equal(number(r.lines[i],'NY'),0);assert.equal(number(r.lines[i],'SW'),1);}
 assert.equal(number(r.lines[2],'X'),4095);assert.equal(number(r.lines[2],'Y'),0);close(number(r.lines[2],'NX'),.88,.01);assert.equal(number(r.lines[2],'NY'),-1);assert.equal(number(r.lines[2],'SW'),0);assert.equal(number(r.lines[2],'SATX'),1);
 assert.equal(number(r.lines[3],'NX'),-1);close(number(r.lines[3],'NY'),.88,.01);assert.equal(number(r.lines[3],'SW'),1);assert.equal(number(r.lines[3],'SATY'),1);
});
for(const key of ['flame','sound'] as const)test(`${key}: live comparator hysteresis and a fresh run are decoded through digitalRead`,async()=>{
 const levels=[52,50,48,50,100,0],want=[1,0,0,1,1,0,1];
 const r=await run(key,7,undefined,(e,i)=>{if(i<levels.length)e.input({component:key+'1',stimulus:levels[i]});});assert.equal(r.error,'');assert.deepEqual(r.lines.map(l=>number(l,'DO')),want);
 if(key==='flame'){const raw=r.lines.map(l=>number(l,'ADC'));assert.equal(raw[0],4095);assert.equal(raw[5],0);}
 const fresh=await run(key);assert.equal(number(fresh.lines[0],'DO'),1);
});
test('two potentiometers and two buttons are four independent live inputs',async()=>{
 const r=await run('dualInputs',4,undefined,(e,i)=>{
  if(i===0){e.input({component:'pot1',position:80});e.input({component:'sw2',pressed:true});}
  if(i===1){e.input({component:'pot2',position:0});e.input({component:'sw1',pressed:true});}
  if(i===2){e.input({component:'pot1',position:0});e.input({component:'sw1',pressed:false});e.input({component:'sw2',pressed:false});}
 });assert.equal(r.error,'');
 assert.deepEqual(r.lines.map(l=>[number(l,'A'),number(l,'B'),number(l,'S1'),number(l,'S2')]),[[1090,3269,1,1],[3487,3269,1,0],[3487,0,0,0],[0,0,1,1]]);
});
for(const key of ['lm35','temt6000','ntc','ky023','flame','sound'] as const)for(const pin of ['VCC','GND'])test(`${key}: disconnected ${pin} is not a valid powered measurement`,async()=>{
 const r=await run(key,1,p=>{c(p).wires=c(p).wires.filter(w=>w.to.pin!==pin);});
 assert.equal(r.frame.analogInputs[key+'1'].powered,false);assert(r.frame.diagnostics.some((d:any)=>d.code==='input-unpowered'));
 if(key==='lm35')assert(r.error&&!r.lines.length);
});
for(const key of ['lm35','temt6000','ntc','ky023','flame','sound'] as const)test(`${key}: disconnected signal stops C++ instead of substituting a slider value`,async()=>{
 const signal=key==='lm35'?'OUT':key==='sound'?'DO':key==='ky023'?'VRX':'AO';
 const r=await run(key,1,p=>{c(p).wires=c(p).wires.filter(w=>w.to.pin!==signal);});assert.match(r.error,/Nepobuđen/);
 assert(r.frame.diagnostics.some((d:any)=>d.code==='input-signal-open'));assert(!r.lines.some(l=>/DO=[01]|ADC=\d|X=\d/.test(l)));
});
test('LM35 connected to 3V3 loses power validity and the real ADC read fails',async()=>{
 const r=await run('lm35',1,p=>{c(p).wires.find(w=>w.to.pin==='VCC')!.from.pin='J1.1';});assert(r.error);assert.equal(r.frame.analogInputs.lm351.powered,false);
 const recovered=await run('lm35');assert.equal(recovered.error,'');close(number(recovered.lines[0],'T'),25);
});
test('a 5 V input module wired to S3 signal is rejected by the electrical compiler',()=>{
 for(const key of ['temt6000','ntc','ky023','flame','sound'] as const){const p=s3ExampleProject(key);c(p).components.find(d=>d.id===key+'1')!.properties.moduleVoltage=5;c(p).wires.find(w=>w.to.pin==='VCC')!.from.pin='J1.21';assert.throws(()=>compileCircuit(c(p)),/prekoračiti/);}
});
test('changes to the sketch or visible conversion header invalidate the bundled artifact',async()=>{
 for(const path of ['main.ino','lab_analog.h']){const p=s3ExampleProject('lm35');p.files[path]+='\n// student edit\n';await assert.rejects(()=>validateArtifact(p,artifacts.lm35),/izvor|hash|odgovara/i);}
});
test('actual compiler executes changed student conversion code and rejects a missing header',async()=>{
 const p=s3ExampleProject('lm35');p.files['main.ino']=p.files['main.ino'].replace('u / 0.010f','u / 0.020f');const artifact=await compileS3(p);
 const r=await run('lm35',1,q=>{q.files['main.ino']=p.files['main.ino'];},undefined,artifact);assert.equal(r.error,'');close(number(r.lines[0],'T'),12.5);
 delete p.files['lab_analog.h'];await assert.rejects(()=>compileS3(p),/lab_analog.h.*not found/);
});
