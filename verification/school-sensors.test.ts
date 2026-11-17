import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {gradeJob} from '../school/grader/official';
import {canonical} from '../school/grader/contract';
import {gradingCoverage,gradingSupport} from '../school/grader/coverage';
import {sensorProfiles,starter,jobFor,compilerOptions,alternateSensor,wrongSensor,movedSensor} from './school-sensors-fixture';
import type {UrsTarget} from '../src/lessons/ursCatalog';
const root=process.cwd(),evidence:any[]=[];
async function run(project:any,profile:any,options:any={root},seed='5'.repeat(64)){
  const job=jobFor(project,profile,seed),result=await gradeJob(job,options);
  evidence.push({profileId:profile.id,target:job.target,snapshotHash:job.snapshotHash,seed,contractHash:job.contractHash,result});return result;
}
test.after(()=>{mkdirSync('docs/stage24d-evidence',{recursive:true});writeFileSync('docs/stage24d-evidence/sensor-results.json',JSON.stringify({format:'labosv2-sensor-evidence',version:1,sourceCommit:process.env.GITHUB_SHA??null,results:evidence},null,2)+'\n');});
test('24D publishes seven contracts, preserves all earlier profile bytes and adds exactly 28 combinations',()=>{
  const registry=JSON.parse(readFileSync('school/grader/profiles.json','utf8'));
  assert.equal(sensorProfiles.length,7);assert.deepEqual(registry.profiles.slice(0,20),JSON.parse(readFileSync('verification/fixtures/24c-grading-profiles.json','utf8')).profiles);
  assert(gradingCoverage('test').summary.supported>=144);
  for(const p of sensorProfiles){assert.equal(p.criteria.reduce((n,c)=>n+c.maxPoints,0),10);assert.equal(p.contract!.scenarioVersion,'24D.1');assert.deepEqual(p.targets,['micropython','s3-cpp','uno','nano']);
    for(const t of p.targets)assert.equal(gradingSupport(p.taskKey,t).profileId,p.id);
  }
});
for(const target of ['micropython','s3-cpp','uno','nano'] as UrsTarget[])test(`24D ${target}: seven reference programs, fault recovery and repeatable results`,{timeout:600000},async()=>{
  for(const p of sensorProfiles){let expected:string|undefined;
    for(let repetition=0;repetition<(target==='micropython'?2:1);repetition++){
      const project=await starter(p.taskKey,target);project.files['forged-results.json']='{"points":999,"authority":"server-verified"}';
      const r=await run(project,p);assert.equal(r.status,'evaluated',JSON.stringify(r));assert.equal(r.points,10,JSON.stringify(r));
      if(expected)assert.equal(canonical(r.samples),expected,p.id);else expected=canonical(r.samples);
    }
  }
});
test('24D MicroPython alternate implementations and layouts pass different private seeded environments',{timeout:90000},async()=>{
  for(const p of sensorProfiles){const a=await run(alternateSensor(await starter(p.taskKey)),p,{root},'a'.repeat(64));assert.equal(a.points,10,JSON.stringify(a));}
});
test('24D output, late-only failure and open electrical paths have distinct scores',{timeout:120000},async()=>{
  for(const p of sensorProfiles){
    const none=await run(wrongSensor(await starter(p.taskKey)),p);assert.equal(none.points,3,JSON.stringify(none));assert.deepEqual(none.criteria.map((r:any)=>r.points),[3,0,0]);
    const late=await run(wrongSensor(await starter(p.taskKey),3*p.contract!.scenario.stageDurationMs!),p);assert.equal(late.points,8,JSON.stringify(late));assert.deepEqual(late.criteria.map((r:any)=>r.points),[3,5,0]);
    const broken=await starter(p.taskKey);if(broken.circuit.kind==='editable')broken.circuit.wires=broken.circuit.wires.filter(w=>![w.from.pin,w.to.pin].some(pin=>['VCC','VDD','DATA','DQ','SDA'].includes(pin)));
    assert.equal((await run(broken,p)).points,0,p.id);
    if(p.taskKey!=='weather/am2320')assert.equal((await run(movedSensor(await starter(p.taskKey)),p)).points,10,p.id);
  }
});
test('24D refuses forged contracts, cached snapshots and numerical transcripts without actual sensor transfers',{timeout:45000},async()=>{
  for(const p of sensorProfiles){const project=await starter(p.taskKey),j=jobFor(project,p);
    for(const patch of [{contractHash:'0'.repeat(64)},{snapshotHash:'0'.repeat(64)},{rubric:{...j.rubric,instructions:'Izmijenjeno'}},{checkerVersion:'24C.1'},{target:'other'}]){
      const r=await gradeJob({...j,...patch},{root});assert.equal(r.status,'unsupported');assert.equal(r.points,null);
    }
    project.files['main.py']='from time import sleep_ms\nwhile True:\n print("T=0 RH=0")\n print("T=25 RH=50")\n sleep_ms(100)\n';
    assert.equal((await run(project,p)).points,0,p.id);
  }
});
test('24D resolution needs actual configuration; stale conversion and false fault values lose points',{timeout:45000},async()=>{
  const resolution=sensorProfiles.find(p=>p.taskKey==='onewire/ds18Resolution')!,p=await starter(resolution.taskKey);
  p.files['main.py']=p.files['main.py'].replace('((bita-9)<<5)|0x1F','0x7F');assert.equal((await run(p,resolution)).points,3);
  const multi=sensorProfiles.find(p=>p.taskKey==='onewire/ds18Multi')!,old=await starter(multi.taskKey);
  old.files['main.py']=old.files['main.py'].replace('sleep_ms(750)','sleep_ms(10)');assert((await run(old,multi)).points<10);
  for(const profile of sensorProfiles.filter(p=>p.taskKey.endsWith('Errors'))){const source=await starter(profile.taskKey);
    source.files['main.py']=source.files['main.py'].replace(/print\("DHT: nevaljano ocitanje:", greska\)/,'print("T=0 RH=0")').replace('print("DS18B20: nevaljano", greska)','print("T=0")');
    assert.equal((await run(source,profile)).points,8,profile.id);
  }
});
for(const target of ['s3-cpp','uno','nano'] as UrsTarget[])for(const p of sensorProfiles)test(`24D ${target} ${p.id}: independently compile reference, alternate and wrong output`,{
  skip:!(target==='s3-cpp'?process.env.LAB_S3_COMPILER_TEST:process.env.LAB_GRADING_COMPILER_TEST),timeout:240000},async()=>{
  for(const alternative of [false,true]){
    let project=await starter(p.taskKey,target);if(alternative)project=alternateSensor(project);else project.files['main.ino']+='\n// independently compiled sensor source\n';
    const r=await run(project,p,compilerOptions(),alternative?'a'.repeat(64):'5'.repeat(64));assert.equal(r.status,'evaluated',JSON.stringify(r));assert.equal(r.points,10,JSON.stringify(r));assert.equal(r.provenance.method,'isolated-source-compilation');
  }
  const r=await run(wrongSensor(await starter(p.taskKey,target)),p,compilerOptions());assert.equal(r.points,3,JSON.stringify(r));
});
