import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {gradeJob} from '../school/grader/official';
import {gradingCoverage,gradingSupport} from '../school/grader/coverage';
import {compileCircuit} from '../src/circuit/compile';
import {ahtTemperature,regulatorAngles,containsEnvironmentNumber,createEnvironmentCheck,validEnvironmentConfig} from '../school/grader/environment';
import fonts from '../school/grader/environment-fonts.json';
import {environmentProfiles,starter,jobFor,compilerOptions,alternateEnvironment,wrongEnvironment} from './school-environment-fixture';
import type {UrsTarget} from '../src/lessons/ursCatalog';

const root=process.cwd(),evidence:any[]=[];
const selected=(t:string)=>!!process.env.LAB_ENVIRONMENT_TARGET&&process.env.LAB_ENVIRONMENT_TARGET!==t;
async function run(project:any,p:any,options:any={root},seed='5'.repeat(64),referenceRepetition?:number){
 const job=jobFor(project,p,seed),result=await gradeJob(job,options);
 evidence.push({referenceRepetition,profileId:p.id,target:job.target,snapshotHash:job.snapshotHash,contractHash:job.contractHash,seed,result});return result;
}
test.after(()=>{mkdirSync('docs/stage24i-evidence',{recursive:true});writeFileSync('docs/stage24i-evidence/environment-'+(process.env.LAB_ENVIRONMENT_TARGET??'all')+'.json',JSON.stringify({format:'labosv2-environment-evidence',version:1,sourceCommit:process.env.GITHUB_SHA??null,results:evidence},null,2)+'\n');});
test('24I publishes two contracts and preserves every previous profile',()=>{
 const r=JSON.parse(readFileSync('school/grader/profiles.json','utf8'));
 assert.deepEqual(r.profiles.slice(0,51),JSON.parse(readFileSync('verification/fixtures/24h-grading-profiles.json','utf8')).profiles);
 assert.equal(environmentProfiles.length,2);assert.equal(gradingCoverage('test').summary.supported>=184,true);
 for(const p of environmentProfiles){assert.deepEqual(p.criteria.map(c=>c.maxPoints),[3,5,2]);for(const t of p.targets)assert(r.profiles.some((row:any)=>row.id===p.id&&row.targets.includes(t)));}
});
test('24I both threshold directions include the neighbouring AHT10 codes and the quantized nominal boundary',()=>{
 assert(ahtTemperature(26)>26);assert(ahtTemperature(25.9998)<26);assert(ahtTemperature(27.9998)<28);assert(ahtTemperature(28)>=28);
 assert.deepEqual(regulatorAngles([24,29,27,25,27,29,25.9998,27.9998,28,26,25.9998,26.0002,28.0002,24]),[0,90,90,0,0,90,0,0,90,90,0,0,90,0]);
});
test('24I numerical pixel masks require the actual ON and OFF bits and ignore free drawing space',()=>{
 for(const target of ['micropython','s3-cpp','avr']){
  const f=(fonts as any)[target],bytes=Array(1024).fill(0),value='26.0';
  for(const [x,col]of value.split('').flatMap(c=>f.glyphs[c]).entries())for(let y=0;y<f.height;y++)if((col as number)&(1<<y))bytes[Math.floor(y/8)*128+x]|=1<<(y%8);
  assert(containsEnvironmentNumber(bytes,value,target,0,14));assert(!containsEnvironmentNumber(bytes,'28.0',target,0,14));
  bytes[1000]=255;assert(containsEnvironmentNumber(bytes,value,target,0,14));bytes.fill(255);assert(!containsEnvironmentNumber(bytes,value,target,0,14));
 }
});
test('24I a console claim or sensor snapshot without a completed read cannot create points',async()=>{
 for(const p of environmentProfiles){const c=compileCircuit((await starter(p.taskKey)).circuit as any);assert(validEnvironmentConfig(c,p.taskKey.split('/')[1]));
  const check=createEnvironmentCheck(c,p,'5'.repeat(64),'micropython');check.observe({type:'console',text:'T=29 RH=65 SERVO=90 points=10'});
  assert.deepEqual(check.outcomes([check.record()],true),[false,false,false]);
 }
});
test('24I numeric fields reject leading digits, trailing digits and an extra decimal point in every font',()=>{
 for(const target of ['micropython','s3-cpp','avr']){
  const f=(fonts as any)[target];
  const render=(value:string)=>{const bytes=Array(1024).fill(0);
   for(const [x,col]of value.split('').flatMap(c=>f.glyphs[c]).entries())for(let y=0;y<f.height;y++)if((col as number)&(1<<y))bytes[Math.floor(y/8)*128+x]|=1<<(y%8);
   return bytes;};
  for(const [actual,expected]of [['124.0','24.0'],['24.01','24.0'],['24.0.','24.0'],['-24.0','24.0']])
   assert(!containsEnvironmentNumber(render(actual),expected,target,0,14),target+' '+actual);
  assert(containsEnvironmentNumber(render('-24.0'),'-24.0',target,0,14));
 }
});
test('24I a leading OLED digit cannot turn a wrong displayed value into full points',{skip:selected('micropython'),timeout:120000},async()=>{
 for(const p of environmentProfiles){const project=await starter(p.taskKey);
  project.files['main.py']=p.taskKey.startsWith('regulator/')?project.files['main.py'].replace('T: %.1f C','T: 1%.1f C'):
   project.files['main.py'].replace('BMP280:%.1fhPa','BMP280:1%.1fhPa');
  const r=await run(project,p);assert.equal(r.status,'evaluated',JSON.stringify(r));assert.equal(r.points,p.taskKey.startsWith('regulator/')?3:8,JSON.stringify(r));
 }
});
for(const target of ['micropython','s3-cpp','uno','nano'] as UrsTarget[])test(`24I ${target}: three repetitions of both independent saved sources`,{skip:selected(target),timeout:600000},async()=>{
 for(const p of environmentProfiles){
  const project=await starter(p.taskKey,target);project.files['forged-result.json']='{"points":1000,"sample":999,"angle":90}';
  for(let i=0;i<3;i++){
   const r=await run(structuredClone(project),p,{root},'5'.repeat(64),i+1);assert.equal(r.status,'evaluated',JSON.stringify(r));assert.equal(r.points,10,JSON.stringify(r));
  }
 }
});
for(const target of ['micropython','s3-cpp','uno','nano'] as UrsTarget[])test(`24I ${target}: each sensor/panel/servo path, wrong address, repair and reversed environments`,{skip:selected(target),timeout:600000},async()=>{
 for(const p of environmentProfiles){const original=await starter(p.taskKey,target);if(original.circuit.kind!=='editable')throw Error('editable');
  for(const part of original.circuit.components.filter(c=>['aht10','bmp180','bmp280','am2320','ssd1306','servo'].includes(c.kind))){
   const project=structuredClone(original);if(project.circuit.kind!=='editable')throw Error('editable');
   const pin=part.kind==='servo'?'SIG':'SDA';project.circuit.wires=project.circuit.wires.filter(w=>![w.from,w.to].some(e=>e.component===part.id&&e.pin===pin));
   const r=await run(project,p);assert.equal(r.points,0,JSON.stringify(r));
  }
  const address=structuredClone(original);if(address.circuit.kind!=='editable')throw Error('editable');address.circuit.components.find(c=>c.kind==='ssd1306')!.properties.address=0x3d;
  assert.equal((await run(address,p)).points,0);
  const repaired=await run(original,p,{root},'0'.repeat(64));assert.equal(repaired.status,'evaluated',JSON.stringify(repaired));assert.equal(repaired.points,10,JSON.stringify(repaired));
 }
});
test('24I alternative MicroPython algorithms and rearranged component identities pass',{skip:selected('micropython'),timeout:180000},async()=>{
 for(const p of environmentProfiles){const r=await run(alternateEnvironment(await starter(p.taskKey),p.taskKey.split('/')[1]),p);assert.equal(r.status,'evaluated',JSON.stringify(r));assert.equal(r.points,10,JSON.stringify(r));}
});
test('24I every functional criterion has a wrong source: 3 and 8 points',{skip:selected('micropython'),timeout:180000},async()=>{
 for(const p of environmentProfiles)for(const advanced of [false,true]){
  const r=await run(wrongEnvironment(await starter(p.taskKey),p.taskKey.split('/')[1],advanced),p);assert.equal(r.status,'evaluated',JSON.stringify(r));assert.equal(r.points,advanced?8:3,JSON.stringify(r));
 }
});
test('24I replay, stale source/artefact and unavailable infrastructure retain null points',{skip:selected('micropython'),timeout:60000},async()=>{
 const p=environmentProfiles[0],job=jobFor(await starter(p.taskKey),p);
 for(const patch of [{snapshotHash:'0'.repeat(64)},{contractHash:'0'.repeat(64)},{checkerVersion:'24H.1'},{target:'other'},{rubric:{...job.rubric,instructions:'changed'}}]){
  const r=await gradeJob({...job,...patch},{root});assert.equal(r.status,'unsupported');assert.equal(r.points,null);
 }
 const missing=await gradeJob(job,{root:'/unavailable-checker'});assert.equal(missing.status,'technical_error');assert.equal(missing.points,null);
 for(const t of ['s3-cpp','uno','nano'] as UrsTarget[]){const changed=await starter(p.taskKey,t);changed.files['main.ino']+='\n// changed source\n';const r=await gradeJob(jobFor(changed,p),{root});assert.equal(r.status,'unsupported');assert.equal(r.points,null);}
});
for(const target of ['s3-cpp','uno','nano'] as UrsTarget[])for(const p of environmentProfiles)test(`24I ${target} ${p.id}: compile reference, alternative and both wrong functional criteria`,{
 skip:selected(target)||!(target==='s3-cpp'?process.env.LAB_S3_COMPILER_TEST:process.env.LAB_GRADING_COMPILER_TEST),timeout:600000},async()=>{
 for(const alternate of [false,true]){
  const project=alternate?alternateEnvironment(await starter(p.taskKey,target),p.taskKey.split('/')[1]):await starter(p.taskKey,target);
  if(!alternate)project.files['main.ino']+='\n// independent 24I reference\n';
  const r=await run(project,p,compilerOptions());assert.equal(r.status,'evaluated',JSON.stringify(r));assert.equal(r.points,10,JSON.stringify(r));assert.equal(r.provenance.method,'isolated-source-compilation');
 }
 for(const advanced of [false,true]){const r=await run(wrongEnvironment(await starter(p.taskKey,target),p.taskKey.split('/')[1],advanced),p,compilerOptions());
  assert.equal(r.status,'evaluated',JSON.stringify(r));assert.equal(r.points,advanced?8:3,JSON.stringify(r));assert.equal(r.provenance.method,'isolated-source-compilation');}
});
