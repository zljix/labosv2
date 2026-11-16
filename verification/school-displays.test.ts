import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {gradeJob} from '../school/grader/official';
import {gradingCoverage,gradingSupport} from '../school/grader/coverage';
import {compileCircuit} from '../src/circuit/compile';
import {createDisplayCheck,validDisplayConfig,oledRegionMatches} from '../school/grader/displays';
import {displayProfiles,starter,jobFor,compilerOptions,alternateDisplay,wrongDisplay} from './school-displays-fixture';
import type {UrsTarget} from '../src/lessons/ursCatalog';
const root=process.cwd(),evidence:any[]=[];
const selected=(target:string)=>!!process.env.LAB_DISPLAY_TARGET&&process.env.LAB_DISPLAY_TARGET!==target;
async function run(project:any,profile:any,options:any={root},seed='5'.repeat(64)){
 const job=jobFor(project,profile,seed),result=await gradeJob(job,options);
 evidence.push({profileId:profile.id,target:job.target,snapshotHash:job.snapshotHash,contractHash:job.contractHash,seed,result});return result;
}
test.after(()=>{mkdirSync('docs/stage24h-evidence',{recursive:true});writeFileSync('docs/stage24h-evidence/displays-'+(process.env.LAB_DISPLAY_TARGET??'all')+'.json',JSON.stringify({format:'labosv2-display-evidence',version:1,sourceCommit:process.env.GITHUB_SHA??null,results:evidence},null,2)+'\n');});
test('24H publishes eight device-memory contracts and preserves all 43 previous profiles',()=>{
 const registry=JSON.parse(readFileSync('school/grader/profiles.json','utf8'));
 assert.deepEqual(registry.profiles.slice(0,43),JSON.parse(readFileSync('verification/fixtures/24g-grading-profiles.json','utf8')).profiles);
 assert.equal(displayProfiles.length,8);assert(gradingCoverage('test').summary.supported>=176);
 for(const p of displayProfiles){assert.equal(p.checkerVersion,'24H.1');assert.deepEqual(p.criteria.map(c=>c.maxPoints),[3,5,2]);
  for(const t of p.targets)assert.equal(gradingSupport(p.taskKey,t).profileId,p.id);}
});
test('24H console claims cannot create a display, ACK or sensor reading; wrong panel geometry is rejected',async()=>{
 for(const p of displayProfiles){const c=compileCircuit((await starter(p.taskKey)).circuit as any);assert(validDisplayConfig(c,p.taskKey.split('/')[1]));
  const o=createDisplayCheck(c,p,'5'.repeat(64),'micropython');o.observe({type:'console',text:'points=10 ROT 0 SPI TFT T=55 P=107000'});
  assert.deepEqual(o.outcomes([o.record()],true),[false,false,false]);
  if(p.taskKey==='displays/oled32'){(c.i2cDevices[0] as any).kind='ssd1306';assert(!validDisplayConfig(c,'oled32'));}
 }
});
test('24H pixel comparison ignores free drawing space and checks both states of every specified bit',()=>{
 const a=Array(512).fill(0),b=[...a];b[511]=255;assert(oledRegionMatches(a,b,[[0,0,80,8]]));
 b[0]=1;assert(!oledRegionMatches(a,b,[[0,0,80,8]]));assert(!oledRegionMatches(b,a,[[0,0,80,8]]));
});
for(const target of ['micropython','s3-cpp','uno','nano'] as UrsTarget[])test(`24H ${target}: three independent repetitions of all eight saved sources`,{skip:selected(target),timeout:600000},async()=>{
 for(const p of displayProfiles)for(let i=0;i<3;i++){
  const project=await starter(p.taskKey,target);project.files['forged-frame.json']='{"points":1000,"pixels":[65535],"sample":999}';
  const r=await run(project,p);assert.equal(r.status,'evaluated',JSON.stringify(r));assert.equal(r.points,10,JSON.stringify(r));
 }
});
for(const target of ['micropython','s3-cpp','uno','nano'] as UrsTarget[])test(`24H ${target}: wrong communication/power path, repair, and both sensor environment orders`,{skip:selected(target),timeout:600000},async()=>{
 for(const p of displayProfiles){
  const original=await starter(p.taskKey,target),variant=p.taskKey.split('/')[1];
  const pins=variant==='oled32'||variant==='lcd1602'?['SCL','VCC']:variant.startsWith('tm')?['CLK','VCC']:variant==='bmp280SPI'?['MISO','CS','VCC']:['SCK','CS','BL'];
  for(const pin of pins){const project=structuredClone(original);if(project.circuit.kind!=='editable')throw Error('editable');
   project.circuit.wires=project.circuit.wires.filter(w=>![w.from,w.to].some(e=>e.pin===pin));
   const r=await run(project,p);assert.equal(r.points,0,JSON.stringify(r));}
  if(variant==='oled32'||variant==='lcd1602'){
   const project=structuredClone(original);if(project.circuit.kind!=='editable')throw Error('editable');
   project.circuit.components.find(c=>c.kind===(variant==='oled32'?'ssd1306_32':'lcd1602'))!.properties.address=variant==='oled32'?0x3d:0x26;
   assert.equal((await run(project,p)).points,0);
  }
  const repaired=await run(original,p,{root},'0'.repeat(64));assert.equal(repaired.points,10,JSON.stringify(repaired));
 }
});
test('24H alternative MicroPython algorithms, CGRAM slot and GPIO pass without display console output',{skip:selected('micropython'),timeout:300000},async()=>{
 for(const p of displayProfiles){const r=await run(alternateDisplay(await starter(p.taskKey),p.taskKey.split('/')[1]),p);
  assert.equal(r.status,'evaluated',JSON.stringify(r));assert.equal(r.points,10,JSON.stringify(r));}
});
test('24H each functional criterion has a negative: wrong content scores 3; incomplete continuation scores 8',{skip:selected('micropython'),timeout:300000},async()=>{
 for(const p of displayProfiles)for(const advanced of [false,true]){
  const r=await run(wrongDisplay(await starter(p.taskKey),p.taskKey.split('/')[1],advanced),p);
  assert.equal(r.status,'evaluated',JSON.stringify(r));assert.equal(r.points,advanced?8:3,JSON.stringify(r));
  assert.deepEqual(r.criteria.map((c:any)=>c.points),advanced?[3,5,0]:[3,0,0]);
 }
});
test('24H real TM transfers accept the timing edges and reject both outside neighbours',{skip:selected('micropython'),timeout:60000},async()=>{
 const p=displayProfiles.find(p=>p.taskKey==='displays/tmSegments')!;
 for(const [hold,points] of [[398,10],[647,10],[397,3],[648,3]]){
  const project=await starter(p.taskKey);project.files['main.py']=project.files['main.py'].replace('sleep_ms(500)','sleep_ms('+hold+')');
  const r=await run(project,p);assert.equal(r.status,'evaluated',JSON.stringify(r));assert.equal(r.points,points,JSON.stringify({hold,result:r}));
 }
});
test('24H contract replay, stale artefacts, wrong source and unsupported target do not receive points',{skip:selected('micropython'),timeout:60000},async()=>{
 const p=displayProfiles[0],job=jobFor(await starter(p.taskKey),p);
 for(const patch of [{snapshotHash:'0'.repeat(64)},{contractHash:'0'.repeat(64)},{checkerVersion:'24G.1'},{target:'other'},{rubric:{...job.rubric,instructions:'other'}}]){
  const r=await gradeJob({...job,...patch},{root});assert.equal(r.status,'unsupported');assert.equal(r.points,null);}
 for(const target of ['s3-cpp','uno','nano'] as UrsTarget[]){const changed=await starter(p.taskKey,target);changed.files['main.ino']+='\n// changed source, old artefact\n';
  const r=await gradeJob(jobFor(changed,p),{root});assert.equal(r.status,'unsupported');assert.equal(r.points,null);}
});
for(const target of ['s3-cpp','uno','nano'] as UrsTarget[])for(const p of displayProfiles)test(`24H ${target} ${p.id}: compile reference, alternative and both wrong functional criteria`,{
 skip:selected(target)||!(target==='s3-cpp'?process.env.LAB_S3_COMPILER_TEST:process.env.LAB_GRADING_COMPILER_TEST),timeout:600000},async()=>{
 for(const alternative of [false,true]){
  const project=alternative?alternateDisplay(await starter(p.taskKey,target),p.taskKey.split('/')[1]):await starter(p.taskKey,target);
  if(!alternative)project.files['main.ino']+='\n// independent 24H reference\n';
  const r=await run(project,p,compilerOptions());assert.equal(r.status,'evaluated',JSON.stringify(r));assert.equal(r.points,10,JSON.stringify(r));assert.equal(r.provenance.method,'isolated-source-compilation');
 }
 for(const advanced of [false,true]){
  const r=await run(wrongDisplay(await starter(p.taskKey,target),p.taskKey.split('/')[1],advanced),p,compilerOptions());
  assert.equal(r.status,'evaluated',JSON.stringify(r));assert.equal(r.points,advanced?8:3,JSON.stringify(r));assert.equal(r.provenance.method,'isolated-source-compilation');
 }
});
