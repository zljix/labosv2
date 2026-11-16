import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {gradeJob} from '../school/grader/official';
import {gradingCoverage,gradingSupport} from '../school/grader/coverage';
import {createStepperCheck,validStepperConfig} from '../school/grader/steppers';
import {compileCircuit} from '../src/circuit/compile';
import {stepperProfiles,starter,jobFor,compilerOptions,alternateStepper,wrongStepper} from './school-steppers-fixture';
import type {UrsTarget} from '../src/lessons/ursCatalog';
import {stepperCircuit} from '../src/circuit/stepperExamples';
import {createCircuitHost} from '../public/circuit-host.mjs';
const root=process.cwd(),evidence:any[]=[];
const selected=(target:string)=>!!process.env.LAB_STEPPER_TARGET&&process.env.LAB_STEPPER_TARGET!==target;
async function run(project:any,profile:any,options:any={root},seed='5'.repeat(64)){
  const job=jobFor(project,profile,seed),result=await gradeJob(job,options);
  evidence.push({profileId:profile.id,target:job.target,snapshotHash:job.snapshotHash,contractHash:job.contractHash,seed,result});return result;
}
test.after(()=>{mkdirSync('docs/stage24g-evidence',{recursive:true});writeFileSync('docs/stage24g-evidence/steppers-'+(process.env.LAB_STEPPER_TARGET??'all')+'.json',JSON.stringify({format:'labosv2-stepper-evidence',version:1,sourceCommit:process.env.GITHUB_SHA??null,results:evidence},null,2)+'\n');});
test('24G publishes three immutable contracts and preserves all 40 older profiles',()=>{
  const registry=JSON.parse(readFileSync('school/grader/profiles.json','utf8'));
  assert.deepEqual(registry.profiles.slice(0,40),JSON.parse(readFileSync('verification/fixtures/24f-grading-profiles.json','utf8')).profiles);
  assert.equal(stepperProfiles.length,3);assert(gradingCoverage('test').summary.supported>=144);
  for(const p of stepperProfiles){assert.equal(p.checkerVersion,'24G.1');assert.equal(p.contract!.scenarioVersion,'24G.1');
    assert.deepEqual(p.criteria.map(c=>c.maxPoints),[3,5,2]);for(const t of p.targets)assert.equal(gradingSupport(p.taskKey,t).profileId,p.id);}
});
test('24G observer ignores console claims and rejects a substituted motor model',async()=>{
  for(const p of stepperProfiles){const c=compileCircuit((await starter(p.taskKey)).circuit as any);assert(validStepperConfig(c));
    const o=createStepperCheck(c,p,'5'.repeat(64));o.observe({type:'console',text:'translator=20 angle=90 points=10'});
    assert.deepEqual(o.outcomes([o.record()],true),[false,false,false]);c.stepperMotors[0].fullSteps=400;assert(!validStepperConfig(c));}
});
test('24G real GPIO model accepts both pulse-period boundaries and rejects each outside neighbour or interrupted hold',()=>{
  const p=stepperProfiles[0];
  for(const [period,interrupted,points]of [[3410,false,10],[3411,false,10],[4609,false,10],[4610,false,10],[3409,false,3],[4611,false,3],[4010,true,3]] as const){
    const c=compileCircuit(stepperCircuit('stepperBasic')),o=createStepperCheck(c,p,'5'.repeat(64));let now=0;
    const h=createCircuitHost(o.observe,{circuit:c,logicVoltage:3.3,nowUs:()=>now,manualPublish:true});
    try{
      for(const [pin,value]of [[2,0],[3,1],[4,0],[5,1],[6,1],[7,0],[8,0],[9,0]])h.mode(pin,1,0,value);
      now=2000;
      for(let burst=0;burst<6;burst++){
        h.write(3,burst%2===0?1:0);now+=10;
        for(let i=0;i<50;i++){h.write(2,1);now+=10;h.write(2,0);now+=period-10;h.flush();}
        if(interrupted){now+=200000;h.write(4,1);h.flush();now+=100000;h.write(4,0);h.flush();now+=300000;}
        else now+=600000;
        h.flush();
      }
      const outcomes=o.outcomes([o.record()],true);assert.equal(outcomes.reduce((n,passed,i)=>n+(passed?[3,5,2][i]:0),0),points,period+' '+interrupted);
    }finally{h.dispose();}
  }
});
test('24G execution windows include three cycles at the slow pulse and pause limits',()=>{
  for(const variant of ['stepperBasic','stepperMicro']){
    const p=stepperProfiles.find(p=>p.taskKey==='stepper/'+variant)!,c=compileCircuit(stepperCircuit(variant as any));
    const o=createStepperCheck(c,p,'5'.repeat(64));let now=0;
    const h=createCircuitHost(o.observe,{circuit:c,logicVoltage:3.3,nowUs:()=>now,manualPublish:true});
    try{
      for(const [pin,value]of [[2,0],[3,1],[4,0],[5,1],[6,1],[7,0],[8,0],[9,0]])h.mode(pin,1,0,value);
      now=2000;
      for(let cycle=0;cycle<3;cycle++)for(const [factor,bits]of (variant==='stepperBasic'?[[1,0]]:[[1,0],[2,1],[4,2],[8,3],[16,7]])){
        h.write(7,bits&1);h.write(8,(bits>>1)&1);h.write(9,(bits>>2)&1);now+=10;
        for(const direction of [1,0]){
          h.write(3,direction);now+=10;
          for(let i=0;i<(variant==='stepperBasic'?50:10*factor);i++){
            h.write(2,1);now+=10;h.write(2,0);now+=4600;h.flush();
          }
          now+=(variant==='stepperBasic'?680:480)*1000;h.flush();
        }
      }
      assert(now/1000<o.duration);assert.deepEqual(o.outcomes([o.record()],true),[true,true,true],variant);
    }finally{h.dispose();}
  }
});
for(const target of ['micropython','s3-cpp','uno','nano'] as UrsTarget[])test(`24G ${target}: three repetitions of all three saved sources`,{skip:selected(target),timeout:600000},async()=>{
  for(const p of stepperProfiles)for(let repetition=0;repetition<3;repetition++){
    const project=await starter(p.taskKey,target);project.files['forged-result.json']='{"points":1000,"translatorTicks":999}';
    const r=await run(project,p);assert.equal(r.status,'evaluated',JSON.stringify(r));assert.equal(r.points,10,JSON.stringify(r));
    assert.equal(r.samples[0].lostTrace,false);assert.equal(r.samples[0].overflow,false);
  }
});
test('24G alternate MicroPython, reordered components and a remapped STEP GPIO pass without output',{skip:selected('micropython'),timeout:240000},async()=>{
  for(const p of stepperProfiles){const r=await run(alternateStepper(await starter(p.taskKey)),p,{root},'a'.repeat(64));assert.equal(r.points,10,JSON.stringify(r));}
});
for(const target of ['micropython','s3-cpp','uno','nano'] as UrsTarget[])test(`24G ${target}: supply boundaries, signal, energy and coil faults`,{skip:selected(target),timeout:600000},async()=>{
  for(const p of stepperProfiles){
    for(const [seed,voltage]of [['0'.repeat(64),8],['00000002'+'0'.repeat(56),35]] as const){const r=await run(await starter(p.taskKey,target),p,{root},seed);assert.equal(r.points,10,JSON.stringify(r));assert.equal(r.samples[0].motorSupplyV,voltage);}
    for(const pin of ['STEP','VMOT','1A']){
      const project=await starter(p.taskKey,target);if(project.circuit.kind!=='editable')throw Error('editable');
      const d=project.circuit.components.find(c=>c.kind==='a4988')!;
      project.circuit.wires=project.circuit.wires.filter(w=>![w.from,w.to].some(e=>e.component===d.id&&e.pin===pin));
      const r=await run(project,p);assert.equal(r.points,0,JSON.stringify(r));
    }
    // The intact source and repaired circuit must work in a fresh session.
    assert.equal((await run(await starter(p.taskKey,target),p)).points,10);
  }
});
test('24G each criterion has a negative: wrong counts score 3, incomplete repeats/control score 8',{skip:selected('micropython'),timeout:300000},async()=>{
  for(const p of stepperProfiles)for(const advanced of [false,true]){
    const r=await run(wrongStepper(await starter(p.taskKey),p.taskKey.split('/')[1],advanced),p);
    assert.equal(r.status,'evaluated',JSON.stringify(r));assert.equal(r.points,advanced?8:3,JSON.stringify(r));
    assert.deepEqual(r.criteria.map((c:any)=>c.points),advanced?[3,5,0]:[3,0,0]);
  }
});
test('24G job, source and contract bindings reject replay and foreign conditions',{skip:selected('micropython'),timeout:60000},async()=>{
  const p=stepperProfiles[0],job=jobFor(await starter(p.taskKey),p);
  for(const patch of [{snapshotHash:'0'.repeat(64)},{contractHash:'0'.repeat(64)},{checkerVersion:'24F.1'},{target:'other'},
    {rubric:{...job.rubric,instructions:'other'}}]){
    const r=await gradeJob({...job,...patch},{root});assert.equal(r.status,'unsupported');assert.equal(r.points,null);
  }
});
for(const target of ['s3-cpp','uno','nano'] as UrsTarget[])for(const p of stepperProfiles)test(`24G ${target} ${p.id}: independently compile reference, alternative and both wrong criteria`,{
  skip:selected(target)||!(target==='s3-cpp'?process.env.LAB_S3_COMPILER_TEST:process.env.LAB_GRADING_COMPILER_TEST),timeout:600000},async()=>{
  for(const alternative of [false,true]){
    const project=alternative?alternateStepper(await starter(p.taskKey,target)):await starter(p.taskKey,target);
    if(!alternative)project.files['main.ino']+='\n// independently compiled 24G reference\n';
    const r=await run(project,p,compilerOptions());assert.equal(r.status,'evaluated',JSON.stringify(r));assert.equal(r.points,10,JSON.stringify(r));assert.equal(r.provenance.method,'isolated-source-compilation');
  }
  for(const advanced of [false,true]){const r=await run(wrongStepper(await starter(p.taskKey,target),p.taskKey.split('/')[1],advanced),p,compilerOptions());
    assert.equal(r.status,'evaluated',JSON.stringify(r));assert.equal(r.points,advanced?8:3,JSON.stringify(r));assert.equal(r.provenance.method,'isolated-source-compilation');}
});
