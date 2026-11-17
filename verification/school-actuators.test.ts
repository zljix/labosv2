import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {gradeJob} from '../school/grader/official';
import {canonical} from '../school/grader/contract';
import {gradingCoverage,gradingSupport} from '../school/grader/coverage';
import {actuatorProfiles,starter,jobFor,compilerOptions,alternateActuator,wrongActuator} from './school-actuators-fixture';
import {createActuatorCheck,validActuatorConfig,actuatorPatterns} from '../school/grader/actuators';
import {compileCircuit} from '../src/circuit/compile';
import type {UrsTarget} from '../src/lessons/ursCatalog';
const root=process.cwd(),evidence:any[]=[];
async function run(project:any,profile:any,options:any={root},seed='5'.repeat(64)){
  const job=jobFor(project,profile,seed),result=await gradeJob(job,options);
  evidence.push({profileId:profile.id,target:job.target,snapshotHash:job.snapshotHash,seed,contractHash:job.contractHash,result});return result;
}
test.after(()=>{mkdirSync('docs/stage24f-evidence',{recursive:true});writeFileSync('docs/stage24f-evidence/actuators-'+(process.env.LAB_ACTUATOR_TARGET??'all')+'.json',JSON.stringify({format:'labosv2-actuator-evidence',version:1,sourceCommit:process.env.GITHUB_SHA??null,results:evidence},null,2)+'\n');});

test('24F publishes seven contracts, preserves all 33 older profiles and adds exactly 28 combinations',()=>{
  const registry=JSON.parse(readFileSync('school/grader/profiles.json','utf8'));
  assert.equal(actuatorProfiles.length,7);assert.deepEqual(registry.profiles.slice(0,33),JSON.parse(readFileSync('verification/fixtures/24e-grading-profiles.json','utf8')).profiles);
  // A newer version may replace the active profile without removing its task/target coverage.
  const preservedCombinations=new Set(registry.profiles.slice(0,40).flatMap((p:any)=>p.targets.map((t:string)=>p.taskKey+'/'+t)));
  assert.equal(preservedCombinations.size,132);
  const supportedCombinations=new Set(gradingCoverage('test').rows.filter(r=>r.grading.status==='supported').map(r=>r.id));
  for(const combination of preservedCombinations)assert(supportedCombinations.has(combination as string),String(combination));
  for(const p of actuatorProfiles){assert.equal(p.criteria.reduce((n,c)=>n+c.maxPoints,0),10);assert.equal(p.contract!.scenarioVersion,'24F.1');
    assert.equal(p.contract!.scenario.stageDurationMs,p.contract!.scenario.cycleDurationMs!*3+400);
    for(const t of p.targets)assert.equal(gradingSupport(p.taskKey,t).profileId,p.id);
  }
});

test('24F electrical observer rejects fabricated console, wrong load models and mismatched simultaneous outputs',async()=>{
  for(const p of actuatorProfiles){
    const project=await starter(p.taskKey);assert.equal(project.circuit.kind,'editable');
    const c=compileCircuit(project.circuit as any),variant=p.taskKey.split('/')[1];assert(validActuatorConfig(c,variant),variant);
    const observer=createActuatorCheck(c,p,'5'.repeat(64));
    observer.observe({type:'console',text:'ALL ACTUATORS CORRECT 10/10'});assert.deepEqual(observer.outcomes([observer.record()],true),[false,false,false]);
    if(c.servos.length){c.servos[0].maxUs=2500;assert(!validActuatorConfig(c,variant));}
    if(c.bridges.length){c.bridges[0].jumperA=true;assert(!validActuatorConfig(c,variant));}
  }
  assert.deepEqual(actuatorPatterns.piezoTone.map(p=>p.durationMs),[400,100,400,100,400,600]);
});

for(const target of ['micropython','s3-cpp','uno','nano'] as UrsTarget[])test(`24F ${target}: all seven actual programs and three deterministic repeated runs`,{
  skip:!!process.env.LAB_ACTUATOR_TARGET&&process.env.LAB_ACTUATOR_TARGET!==target,timeout:600000},async()=>{
  for(const p of actuatorProfiles){let expected:string|undefined;
    for(let repetition=0;repetition<3;repetition++){
      const project=await starter(p.taskKey,target);project.files['forged-results.json']='{"points":999,"authority":"server-verified"}';
      const r=await run(project,p);assert.equal(r.status,'evaluated',JSON.stringify(r));assert.equal(r.points,10,JSON.stringify(r));
      // Observation counts may vary across the runtime's event-loop batching;
      // electrical transitions and criterion decisions must not vary.
      const samples=r.samples.map(({observations,...sample}:any)=>sample);
      if(expected)assert.equal(canonical(samples),expected,p.id);else expected=canonical(samples);
    }
  }
});

test('24F alternate MicroPython algorithms and renamed/reordered layouts accept another private supply',{skip:!!process.env.LAB_ACTUATOR_TARGET&&process.env.LAB_ACTUATOR_TARGET!=='micropython',timeout:180000},async()=>{
  for(const p of actuatorProfiles){const r=await run(alternateActuator(await starter(p.taskKey)),p,{root},'a'.repeat(64));assert.equal(r.points,10,JSON.stringify(r));}
});

for(const target of ['micropython','s3-cpp','uno','nano'] as UrsTarget[])test(`24F ${target}: lower energy bound and independent signal/energy faults`,{
  skip:!!process.env.LAB_ACTUATOR_TARGET&&process.env.LAB_ACTUATOR_TARGET!==target,timeout:300000},async()=>{
  for(const p of actuatorProfiles){
    const variant=p.taskKey.split('/')[1];
    if(['dcDrive','dualDrive','servoMotorTone'].includes(variant)){
      const low=await run(await starter(p.taskKey,target),p,{root},'0'.repeat(64));
      assert.equal(low.points,10,JSON.stringify(low));assert.equal(low.samples[0].motorSupplyV,5.6);
    }
    if(target==='micropython')continue; // covered with exact partial scores below
    for(const energy of [false,true]){
      const broken=await starter(p.taskKey,target);if(broken.circuit.kind!=='editable')throw Error('editable');
      const first=broken.circuit.components.find(c=>['relay','activeBuzzer','passiveBuzzer','sg90','l298n'].includes(c.kind))!;
      const pin=energy?first.kind==='sg90'?'V+':first.kind==='l298n'?'VS':'VCC':first.kind==='relay'?'IN':first.kind==='l298n'?'ENA':'SIG';
      broken.circuit.wires=broken.circuit.wires.filter(w=>!([w.from,w.to].some(e=>e.component===first.id&&e.pin===pin)));
      assert.equal((await run(broken,p)).points,0,target+' '+variant+' '+pin);
    }
  }
});

test('24F every criterion has a negative, with exact 3/8/0 scores and separate signal/energy faults',{skip:!!process.env.LAB_ACTUATOR_TARGET&&process.env.LAB_ACTUATOR_TARGET!=='micropython',timeout:240000},async()=>{
  for(const p of actuatorProfiles){
    const variant=p.taskKey.split('/')[1],bad=await run(wrongActuator(await starter(p.taskKey),variant),p);
    assert.equal(bad.points,3,JSON.stringify(bad));assert.deepEqual(bad.criteria.map((c:any)=>c.points),[3,0,0]);
    const late=await run(wrongActuator(await starter(p.taskKey),variant,true),p);assert.equal(late.points,8,JSON.stringify(late));assert.deepEqual(late.criteria.map((c:any)=>c.points),[3,5,0]);
    for(const energy of [false,true]){
      const broken=await starter(p.taskKey);if(broken.circuit.kind!=='editable')throw Error('editable');
      const first=broken.circuit.components.find(c=>['relay','activeBuzzer','passiveBuzzer','sg90','l298n'].includes(c.kind))!;
      const pin=energy?first.kind==='sg90'?'V+':first.kind==='l298n'?'VS':'VCC':first.kind==='relay'?'IN':first.kind==='l298n'?'ENA':'SIG';
      broken.circuit.wires=broken.circuit.wires.filter(w=>!([w.from,w.to].some(e=>e.component===first.id&&e.pin===pin)));
      assert.equal((await run(broken,p)).points,0,variant+' '+pin);
    }
  }
});

test('24F immutable job binding rejects changed source hashes, foreign contracts and unsupported targets',{skip:!!process.env.LAB_ACTUATOR_TARGET&&process.env.LAB_ACTUATOR_TARGET!=='micropython',timeout:60000},async()=>{
  for(const p of actuatorProfiles){const job=jobFor(await starter(p.taskKey),p);
    for(const patch of [{snapshotHash:'0'.repeat(64)},{contractHash:'0'.repeat(64)},{checkerVersion:'24E.1'},{target:'other'},{rubric:{...job.rubric,instructions:'changed'}}]){
      const r=await gradeJob({...job,...patch},{root});assert.equal(r.status,'unsupported');assert.equal(r.points,null);
    }
  }
});

for(const target of ['s3-cpp','uno','nano'] as UrsTarget[])for(const p of actuatorProfiles)test(`24F ${target} ${p.id}: independent reference, alternate and wrong source compilation`,{
  skip:(!!process.env.LAB_ACTUATOR_TARGET&&process.env.LAB_ACTUATOR_TARGET!==target)||!(target==='s3-cpp'?process.env.LAB_S3_COMPILER_TEST:process.env.LAB_GRADING_COMPILER_TEST),timeout:300000},async()=>{
  for(const alternative of [false,true]){
    let project=await starter(p.taskKey,target);if(alternative)project=alternateActuator(project);else project.files['main.ino']+='\n// independent 24F source build\n';
    const r=await run(project,p,compilerOptions(),alternative?'a'.repeat(64):'5'.repeat(64));assert.equal(r.status,'evaluated',JSON.stringify(r));assert.equal(r.points,10,JSON.stringify(r));assert.equal(r.provenance.method,'isolated-source-compilation');
  }
  const r=await run(wrongActuator(await starter(p.taskKey,target),p.taskKey.split('/')[1]),p,compilerOptions());assert.equal(r.points,3,JSON.stringify(r));
});

for(const target of ['uno','nano'] as UrsTarget[])for(const timer of ['Servo','tone'])test(`24F ${target}: actual ${timer} timer conflict disrupts motor PWM`,{
  skip:(!!process.env.LAB_ACTUATOR_TARGET&&process.env.LAB_ACTUATOR_TARGET!==target)||!process.env.LAB_GRADING_COMPILER_TEST,timeout:180000},async()=>{
  const p=actuatorProfiles.find(p=>p.taskKey==='actuators/servoMotorTone')!,project=await starter(p.taskKey,target);
  assert.equal(project.circuit.kind,'editable');if(project.circuit.kind!=='editable')throw Error('editable');
  const board=project.circuit.components.find(c=>c.kind==='board')!,pin=timer==='Servo'?'D9':'D3';
  for(const w of project.circuit.wires)for(const e of [w.from,w.to])if(e.component===board.id&&e.pin==='D5')e.pin=pin;
  project.files['main.ino']=project.files['main.ino'].replace('ENA = 5','ENA = '+(timer==='Servo'?9:3));
  const r=await run(project,p,compilerOptions());assert.equal(r.status,'evaluated');assert.equal(r.points,3,JSON.stringify(r));
});
