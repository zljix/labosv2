import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {gradeJob} from '../school/grader/official';
import {gradingCoverage,gradingSupport} from '../school/grader/coverage';
import {compileCircuit} from '../src/circuit/compile';
import {createOpticalCheck,validOpticalConfig} from '../school/grader/optical';
import {MAX30102} from '../public/max30102.mjs';
import {opticalProfiles,starter,jobFor,compilerOptions,alternateOptical,wrongOptical} from './school-optical-fixture';
import type {UrsTarget} from '../src/lessons/ursCatalog';
const root=process.cwd(),evidence:any[]=[];
const selected=(target:string)=>!!process.env.LAB_OPTICAL_TARGET&&process.env.LAB_OPTICAL_TARGET!==target;
async function run(project:any,profile:any,options:any={root},seed='5'.repeat(64)){
  const job=jobFor(project,profile,seed),result=await gradeJob(job,options);
  evidence.push({profileId:profile.id,target:job.target,snapshotHash:job.snapshotHash,contractHash:job.contractHash,seed,result});return result;
}
test.after(()=>{mkdirSync('docs/stage24l-evidence',{recursive:true});writeFileSync('docs/stage24l-evidence/optical-'+(process.env.LAB_OPTICAL_TARGET??'all')+'.json',JSON.stringify({format:'labosv2-optical-evidence',version:1,sourceCommit:process.env.GITHUB_SHA??null,results:evidence},null,2)+'\n');});
test('24L publishes four existing optical variants and preserves all 65 previous contracts',()=>{
  const registry=JSON.parse(readFileSync('school/grader/profiles.json','utf8'));
  assert.deepEqual(registry.profiles.slice(0,65),JSON.parse(readFileSync('verification/fixtures/24k-grading-profiles.json','utf8')).profiles);
  assert.equal(opticalProfiles.length,4);assert(gradingCoverage('test').summary.supported>=248);
  for(const p of opticalProfiles){assert.deepEqual(p.criteria.map(c=>c.maxPoints),[3,5,2]);for(const t of p.targets)assert.equal(gradingSupport(p.taskKey,t).profileId,p.id);}
});
test('24L fake console output cannot create identity, registers or FIFO samples',async()=>{
  for(const p of opticalProfiles){const c=compileCircuit((await starter(p.taskKey)).circuit as any);assert(validOpticalConfig(c));
    const check=createOpticalCheck(c,p,'5'.repeat(64));check.observe({type:'console',text:'MAX ID=0x15 RAW N=10 RED=1 IR=1 FREQ=72 bpm (sintetski) points=10'});
    assert.deepEqual(check.outcomes([check.record()],true),[false,false,false]);
  }
});
test('24L a frame before I2C STOP waits for completion instead of permanently discarding the sample',async()=>{
  const p=opticalProfiles.find(p=>p.taskKey==='optical/opticalRaw')!,c=compileCircuit((await starter(p.taskKey)).circuit as any);
  const check=createOpticalCheck(c,p,'5'.repeat(64)),device=c.i2cDevices[0];let now=0;
  const m=new MAX30102(device,()=>now),put=(r:number,v:number)=>{m.onAddress(true);m.write(Uint8Array.of(r,v));m.end(true);};
  for(const [r,v]of [[8,0],[10,39],[12,31],[13,31],[9,3]])put(r,v);
  now=20;m.onAddress(true);m.write(Uint8Array.of(7));m.end(true);m.onAddress(false);m.read(6);
  const frame=()=>({type:'simulation',timeMs:now,optical:{[device.id]:m.snapshot(true)}});
  check.observe(frame());m.end(false);check.observe(frame());
  assert.equal(check.record().completeSamples,1);
});
for(const target of ['micropython','s3-cpp','uno','nano'] as UrsTarget[])test(`24L ${target}: three independent repetitions of all four saved sources`,{skip:selected(target),timeout:1200000},async()=>{
  for(const p of opticalProfiles)for(let i=0;i<3;i++){
    const project=await starter(p.taskKey,target);project.files['forged-frame.json']='{"points":1000,"optical":{"optical1":{"mode":3,"readings":[{"red":1,"ir":1}]}}}';
    const before=JSON.stringify(project),r=await run(project,p);assert.equal(r.status,'evaluated',JSON.stringify(r));assert.equal(r.points,10,JSON.stringify(r));assert.equal(JSON.stringify(project),before);
  }
});
for(const target of ['micropython','s3-cpp','uno','nano'] as UrsTarget[])test(`24L ${target}: two open I2C paths, repair and a second source seed`,{skip:selected(target),timeout:1200000},async()=>{
  for(const p of opticalProfiles){const original=await starter(p.taskKey,target);
    for(const pin of ['SDA','SCL']){
      const project=structuredClone(original);if(project.circuit.kind!=='editable')throw Error('editable');
      const id=project.circuit.components.find(c=>c.kind==='max30102')!.id;
      project.circuit.wires=project.circuit.wires.filter(w=>![w.from,w.to].some(e=>e.component===id&&e.pin===pin));
      const r=await run(project,p);assert.equal(r.points,0,JSON.stringify(r));
    }
    const r=await run(original,p,{root},'0'.repeat(64));assert.equal(r.status,'evaluated',JSON.stringify(r));assert.equal(r.points,10,JSON.stringify(r));
  }
});
test('24L alternative MicroPython algorithms, remapped pins and renamed/reordered components pass',{skip:selected('micropython'),timeout:600000},async()=>{
  for(const p of opticalProfiles){const r=await run(alternateOptical(await starter(p.taskKey)),p);
    assert.equal(r.status,'evaluated',JSON.stringify(r));assert.equal(r.points,10,JSON.stringify(r));}
});
test('24L independently wrong basic and advanced criteria produce 3/10 and 8/10',{skip:selected('micropython'),timeout:600000},async()=>{
  for(const p of opticalProfiles)for(const advanced of [false,true]){
    const r=await run(wrongOptical(await starter(p.taskKey),p.taskKey.split('/')[1],advanced),p);
    assert.equal(r.status,'evaluated',JSON.stringify(r));assert.equal(r.points,advanced?8:3,JSON.stringify(r));
    assert.deepEqual(r.criteria.map((c:any)=>c.points),advanced?[3,5,0]:[3,0,0]);
  }
});
test('24L executable forged reports and partial FIFO words cannot earn points',{skip:selected('micropython'),timeout:60000},async()=>{
  for(const p of opticalProfiles){const project=await starter(p.taskKey);project.files['main.py']='from time import sleep_ms\nwhile True:\n print("MAX ID=0x15")\n print("MAX MODE=3 CONFIG=0x27")\n print("RAW N=10 RED=425 IR=500")\n print("FREQ=72.00 bpm (sintetski)")\n print("FIFO COUNT=32 OVF=31")\n print("FIFO RECOVERED")\n sleep_ms(100)\n';
    const r=await run(project,p);assert.equal(r.points,0,JSON.stringify(r));
  }
  const p=opticalProfiles.find(p=>p.taskKey==='optical/opticalRaw')!,project=await starter(p.taskKey);
  project.files['lab_max30102.py']=project.files['lab_max30102.py'].replace('self.channels * 3','self.channels * 3 - 1');
  const r=await run(project,p);assert.equal(r.points,0,JSON.stringify(r));assert.equal(r.status,'program_error');
});
test('24L tampered contracts, snapshots and stale Arduino binaries receive no points',{skip:selected('micropython'),timeout:60000},async()=>{
  const p=opticalProfiles[0],job=jobFor(await starter(p.taskKey),p);
  for(const patch of [{snapshotHash:'0'.repeat(64)},{contractHash:'0'.repeat(64)},{checkerVersion:'24K.1'},{target:'other'},{rubric:{...job.rubric,instructions:'other'}}]){
    const r=await gradeJob({...job,...patch},{root});assert.equal(r.status,'unsupported');assert.equal(r.points,null);}
  for(const target of ['s3-cpp','uno','nano'] as UrsTarget[]){const changed=await starter(p.taskKey,target);changed.files['main.ino']+='\n// changed source, old binary\n';
    const r=await gradeJob(jobFor(changed,p),{root});assert.equal(r.status,'unsupported');assert.equal(r.points,null);}
});
test('24L shutdown confirmation follows the actual wait rather than an early empty-FIFO claim',{skip:selected('micropython'),timeout:60000},async()=>{
  const p=opticalProfiles[0],project=await starter(p.taskKey);
  project.files['main.py']=project.files['main.py'].replace('sleep_ms(500)','sleep_ms(1)')+'\nsleep_ms(500)\n';
  const r=await run(project,p);assert.equal(r.status,'evaluated',JSON.stringify(r));assert.equal(r.points,8,JSON.stringify(r));
});
for(const target of ['s3-cpp','uno','nano'] as UrsTarget[])for(const p of opticalProfiles)test(`24L ${target} ${p.id}: compile reference, alternative and both wrong criteria`,{
  skip:selected(target)||!(target==='s3-cpp'?process.env.LAB_S3_COMPILER_TEST:process.env.LAB_GRADING_COMPILER_TEST),timeout:600000},async()=>{
  for(const alternative of [false,true]){
    const project=alternative?alternateOptical(await starter(p.taskKey,target)):await starter(p.taskKey,target);
    if(!alternative)project.files['main.ino']+='\n// independent 24L reference\n';
    const r=await run(project,p,compilerOptions());assert.equal(r.status,'evaluated',JSON.stringify(r));assert.equal(r.points,10,JSON.stringify(r));assert.equal(r.provenance.method,'isolated-source-compilation');
  }
  for(const advanced of [false,true]){
    const r=await run(wrongOptical(await starter(p.taskKey,target),p.taskKey.split('/')[1],advanced),p,compilerOptions());
    assert.equal(r.status,'evaluated',JSON.stringify(r));assert.equal(r.points,advanced?8:3,JSON.stringify(r));assert.equal(r.provenance.method,'isolated-source-compilation');
  }
});
