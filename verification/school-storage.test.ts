import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {gradeJob} from '../school/grader/official';
import {gradingCoverage,gradingSupport} from '../school/grader/coverage';
import {compileCircuit} from '../src/circuit/compile';
import {createStorageCheck,validStorageConfig} from '../school/grader/storage';
import {sdBaseBlock} from '../public/sd-card.mjs';
import {storageProfiles,starter,jobFor,compilerOptions,alternateStorage,wrongStorage} from './school-storage-fixture';
import type {UrsTarget} from '../src/lessons/ursCatalog';
const root=process.cwd(),evidence:any[]=[];
const selected=(target:string)=>!!process.env.LAB_STORAGE_TARGET&&process.env.LAB_STORAGE_TARGET!==target;
async function run(project:any,profile:any,options:any={root},seed='5'.repeat(64)){
  const job=jobFor(project,profile,seed),result=await gradeJob(job,options);
  evidence.push({profileId:profile.id,target:job.target,snapshotHash:job.snapshotHash,contractHash:job.contractHash,seed,result});return result;
}
test.after(()=>{mkdirSync('docs/stage24k-evidence',{recursive:true});writeFileSync('docs/stage24k-evidence/storage-'+(process.env.LAB_STORAGE_TARGET??'all')+'.json',JSON.stringify({format:'labosv2-storage-evidence',version:1,sourceCommit:process.env.GITHUB_SHA??null,results:evidence},null,2)+'\n');});
test('24K publishes exactly the six existing URS variants and preserves all 59 previous contracts',()=>{
  const registry=JSON.parse(readFileSync('school/grader/profiles.json','utf8'));
  assert.deepEqual(registry.profiles.slice(0,59),JSON.parse(readFileSync('verification/fixtures/24j-grading-profiles.json','utf8')).profiles);
  assert.equal(storageProfiles.length,6);assert(gradingCoverage('test').summary.supported>=232);
  for(const p of storageProfiles){assert.deepEqual(p.criteria.map(c=>c.maxPoints),[3,5,2]);for(const t of p.targets)assert.equal(gradingSupport(p.taskKey,t).profileId,p.id);}
  assert.equal(gradingSupport('storage/rtcSet','micropython').status,'unsupported');
  assert.equal(gradingSupport('storage/sdBlocks','micropython').status,'unsupported');
});
test('24K fake reports cannot create completed RTC bytes, SD sectors or received display segments',async()=>{
  for(const p of storageProfiles){const c=compileCircuit((await starter(p.taskKey)).circuit as any);assert(validStorageConfig(c,p.taskKey.split('/')[1]));
    const check=createStorageCheck(c,p,'5'.repeat(64));check.observe({type:'console',text:'SD FILE BYTES=28 RTC RAM=201 WP=1 points=10'});
    assert.deepEqual(check.outcomes([check.record()],true),[false,false,false]);
  }
});
for(const target of ['micropython','s3-cpp','uno','nano'] as UrsTarget[])test(`24K ${target}: three independent repetitions of all six saved sources`,{skip:selected(target),timeout:1200000},async()=>{
  for(const p of storageProfiles)for(let i=0;i<3;i++){
    const project=await starter(p.taskKey,target);project.files['forged-frame.json']='{"points":1000,"rtcDevices":{"rtc1":{"iso":"2028-02-29T00:00:00"}},"writes":999}';
    const r=await run(project,p);assert.equal(r.status,'evaluated',JSON.stringify(r));assert.equal(r.points,10,JSON.stringify(r));
  }
});
for(const target of ['micropython','s3-cpp','uno','nano'] as UrsTarget[])test(`24K ${target}: two open paths, repair and a second calendar/RAM seed`,{skip:selected(target),timeout:1200000},async()=>{
  for(const p of storageProfiles){const original=await starter(p.taskKey,target),v=p.taskKey.split('/')[1];
    const faults=v==='rtcClock'?[['ds1302','IO'],['tm1637','DIO']]:v==='sdLogger'?[['ds1302','IO'],['microSD','MISO']]:
      v.startsWith('rtc')?[['ds1302','IO'],['ds1302','SCLK']]:[['microSD','MISO'],['microSD','MOSI']];
    for(const [kind,pin]of faults){
      const project=structuredClone(original);if(project.circuit.kind!=='editable')throw Error('editable');
      const id=project.circuit.components.find(c=>c.kind===kind)!.id;
      project.circuit.wires=project.circuit.wires.filter(w=>![w.from,w.to].some(e=>e.component===id&&e.pin===pin));
      const r=await run(project,p);assert.equal(r.points,0,JSON.stringify(r));
    }
    const r=await run(original,p,{root},'0'.repeat(64));assert.equal(r.status,'evaluated',JSON.stringify(r));assert.equal(r.points,10,JSON.stringify(r));
  }
});
test('24K alternative MicroPython algorithms, remapped pins and renamed/reordered components pass',{skip:selected('micropython'),timeout:600000},async()=>{
  for(const p of storageProfiles){const r=await run(alternateStorage(await starter(p.taskKey),p.taskKey.split('/')[1]),p);
    assert.equal(r.status,'evaluated',JSON.stringify(r));assert.equal(r.points,10,JSON.stringify(r));}
});
test('24K independent wrong criteria produce exactly 3/10 and 8/10',{skip:selected('micropython'),timeout:600000},async()=>{
  for(const p of storageProfiles)for(const advanced of [false,true]){
    const r=await run(wrongStorage(await starter(p.taskKey),p.taskKey.split('/')[1],advanced),p);
    assert.equal(r.status,'evaluated',JSON.stringify(r));assert.equal(r.points,advanced?8:3,JSON.stringify(r));
    assert.deepEqual(r.criteria.map((c:any)=>c.points),advanced?[3,5,0]:[3,0,0]);
  }
});
function prefixedState(){
  const fat=sdBaseBlock(1);fat[4]=fat[5]=255;
  const entry=new Uint8Array(512);entry.set(new TextEncoder().encode('LAB     TXT'));entry[11]=32;entry[26]=2;entry[28]=254;entry[29]=1;
  const data=new Uint8Array(512);data.fill(88,0,510);
  return {version:1 as const,blocks:[...[1,65].map(n=>[n,Buffer.from(fat).toString('base64')] as [number,string]),[129,Buffer.from(entry).toString('base64')] as [number,string],[133,Buffer.from(data).toString('base64')] as [number,string]]};
}
for(const target of ['micropython','s3-cpp','uno','nano'] as UrsTarget[])test(`24K ${target}: preserve saved FAT16 prefix across the 512-byte boundary`,{skip:selected(target),timeout:120000},async()=>{
  const p=storageProfiles.find(p=>p.taskKey==='storage/sdFiles')!,project=await starter(p.taskKey,target);
  if(project.circuit.kind!=='editable')throw Error('editable');project.circuit.components.find(c=>c.kind==='microSD')!.properties.sdState=prefixedState();
  const before=JSON.stringify(project),r=await run(project,p);assert.equal(r.points,10,JSON.stringify(r));assert.equal(JSON.stringify(project),before);
  assert.equal(r.samples[0].expectedBytes,538);assert.equal(r.samples[0].actualBytes,538);
});
test('24K changed contracts, snapshots and stale Arduino binaries receive no points',{skip:selected('micropython'),timeout:60000},async()=>{
  const p=storageProfiles[0],job=jobFor(await starter(p.taskKey),p);
  for(const patch of [{snapshotHash:'0'.repeat(64)},{contractHash:'0'.repeat(64)},{checkerVersion:'24J.1'},{target:'other'},{rubric:{...job.rubric,instructions:'other'}}]){
    const r=await gradeJob({...job,...patch},{root});assert.equal(r.status,'unsupported');assert.equal(r.points,null);}
  for(const target of ['s3-cpp','uno','nano'] as UrsTarget[]){const changed=await starter(p.taskKey,target);changed.files['main.ino']+='\n// changed source, old binary\n';
    const r=await gradeJob(jobFor(changed,p),{root});assert.equal(r.status,'unsupported');assert.equal(r.points,null);}
});
for(const target of ['s3-cpp','uno','nano'] as UrsTarget[])for(const p of storageProfiles)test(`24K ${target} ${p.id}: compile reference, alternative and both wrong criteria`,{
  skip:selected(target)||!(target==='s3-cpp'?process.env.LAB_S3_COMPILER_TEST:process.env.LAB_GRADING_COMPILER_TEST),timeout:600000},async()=>{
  for(const alternative of [false,true]){
    const project=alternative?alternateStorage(await starter(p.taskKey,target),p.taskKey.split('/')[1]):await starter(p.taskKey,target);
    if(!alternative)project.files['main.ino']+='\n// independent 24K reference\n';
    const r=await run(project,p,compilerOptions());assert.equal(r.status,'evaluated',JSON.stringify(r));assert.equal(r.points,10,JSON.stringify(r));assert.equal(r.provenance.method,'isolated-source-compilation');
  }
  for(const advanced of [false,true]){
    const r=await run(wrongStorage(await starter(p.taskKey,target),p.taskKey.split('/')[1],advanced),p,compilerOptions());
    assert.equal(r.status,'evaluated',JSON.stringify(r));assert.equal(r.points,advanced?8:3,JSON.stringify(r));assert.equal(r.provenance.method,'isolated-source-compilation');
  }
});
