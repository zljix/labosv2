import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {gradeJob} from '../school/grader/official';
import {canonical} from '../school/grader/contract';
import {gradingCoverage,gradingSupport} from '../school/grader/coverage';
import {analogProfiles,starter,jobFor,compilerOptions,alternateAnalog,wrongAnalog,moveAnalogGPIO} from './school-analog-fixture';
import type {UrsTarget} from '../src/lessons/ursCatalog';
const root=process.cwd(),evidence:any[]=[];
async function run(project:any,profile:any,options:any={root},seed='5'.repeat(64)){
  const job=jobFor(project,profile,seed),result=await gradeJob(job,options);
  evidence.push({profileId:profile.id,target:job.target,snapshotHash:job.snapshotHash,seed,contractHash:job.contractHash,result});return result;
}
test.after(()=>{mkdirSync('docs/stage24c-evidence',{recursive:true});writeFileSync('docs/stage24c-evidence/analog-results.json',JSON.stringify({format:'labosv2-analog-evidence',version:1,sourceCommit:process.env.GITHUB_SHA??null,results:evidence},null,2)+'\n');});
test('24C publishes eight distinct contracts, preserves all earlier bytes and adds exactly 28 combinations',()=>{
  const registry=JSON.parse(readFileSync('school/grader/profiles.json','utf8'));
  assert.equal(analogProfiles.length,8);assert.deepEqual(registry.profiles.slice(0,12),JSON.parse(readFileSync('verification/fixtures/24ab-grading-profiles.json','utf8')).profiles);
  assert(gradingCoverage('test').summary.supported>=144);
  for(const p of analogProfiles){assert.equal(p.criteria.reduce((n,c)=>n+c.maxPoints,0),10);assert.equal(p.contract!.scenarioVersion,'24C.1');assert.deepEqual(p.targets,['micropython','s3-cpp','uno','nano']);}
  assert.equal(gradingSupport('gpio/adc','uno').profileId,'24C-adc-pwm@1');
  assert.equal(registry.profiles.find((p:any)=>p.id==='24B-analog-threshold@1').kind,'analog');
});
for(const target of ['micropython','s3-cpp','uno','nano'] as UrsTarget[])test(`24C ${target}: eight reference programs, all ranges and three identical executions`,{timeout:180000},async()=>{
  for(const p of analogProfiles){let samples:string|undefined;
    for(let repetition=0;repetition<3;repetition++){
      const source=await starter(p.taskKey,target);source.files['untrusted-result.json']='{"points":99,"hex":"FORGED","wasm":"FORGED"}';
      const r=await run(source,p);assert.equal(r.status,'evaluated',JSON.stringify(r));assert.equal(r.points,10,JSON.stringify(r));
      if(samples)assert.equal(canonical(r.samples),samples,p.id);else samples=canonical(r.samples);
    }
  }
});
test('24C MicroPython: second implementations, reordered equivalent layouts and changed seeded inputs',{timeout:60000},async()=>{
  for(const p of analogProfiles){const r=await run(alternateAnalog(await starter(p.taskKey)),p,{root},'a'.repeat(64));assert.equal(r.points,10,JSON.stringify(r));}
});
test('24C wrong outputs lose 5 and 2; isolated later failure loses exactly 2; missing connections lose all points',{timeout:90000},async()=>{
  for(const p of analogProfiles){const variant=p.taskKey.split('/')[1];
    const output=await run(wrongAnalog(await starter(p.taskKey),variant),p);assert.equal(output.points,3,JSON.stringify(output));assert.deepEqual(output.criteria.map((c:any)=>c.points),[3,0,0]);
    const later=await run(wrongAnalog(await starter(p.taskKey),variant,true),p);assert.equal(later.points,8,JSON.stringify(later));assert.deepEqual(later.criteria.map((c:any)=>c.points),[3,5,0]);
    const broken=await starter(p.taskKey);if(broken.circuit.kind==='editable')broken.circuit.wires=broken.circuit.wires.filter(w=>![w.from.pin,w.to.pin].some(pin=>['VCC','2','AO','OUT','VRX','DO'].includes(pin)));
    const r=await run(broken,p);assert.equal(r.points,0,JSON.stringify(r));
  }
});
test('24C ADC/PWM rejects the earlier digital threshold and wrong full-scale voltage; GPIO alternatives work',{timeout:30000},async()=>{
  const p=analogProfiles[0],threshold=await starter(p.taskKey);
  threshold.files['main.py']='from machine import Pin,ADC\nfrom time import sleep_ms\na=ADC(Pin(1),atten=ADC.ATTN_11DB)\nl=Pin(4,Pin.OUT)\nwhile True:\n l.value(a.read()>=2048)\n sleep_ms(20)\n';
  const r=await run(threshold,p);assert.equal(r.points,3,JSON.stringify(r));
  const wrong=await starter('analog/temt6000');wrong.files['main.py']=wrong.files['main.py'].replace('a.read_uv()/1000000','a.read()*3.3/4095');
  assert.equal((await run(wrong,analogProfiles.find(p=>p.taskKey==='analog/temt6000')!)).points,3);
  for(const p of analogProfiles)assert.equal((await run(moveAnalogGPIO(await starter(p.taskKey)),p)).points,10,p.id);
});
test('24C stale output and altered contracts or snapshots never inherit current full points',{timeout:30000},async()=>{
  for(const p of analogProfiles){
    const source=await starter(p.taskKey);const j=jobFor(source,p);
    for(const patch of [{contractHash:'0'.repeat(64)},{snapshotHash:'0'.repeat(64)},{rubric:{...j.rubric,instructions:'Izmijenjeno'}},{checkerVersion:'24AB.1'},{target:'other'}]){
      const r=await gradeJob({...j,...patch},{root});assert.equal(r.status,'unsupported');assert.equal(r.points,null);
    }
    if(p.taskKey!=='gpio/adc'){
      source.files['main.py']=source.files['main.py'].replaceAll('sleep_ms(300)','sleep_ms(800)');
      const r=await run(source,p);assert.equal(r.points,3,JSON.stringify(r));
    }
  }
});
test('24C a timed digital transcript without reading the input cannot replace a seeded comparator check',{timeout:15000},async()=>{
  const p=analogProfiles.find(p=>p.taskKey==='analog/sound')!,source=await starter(p.taskKey);
  source.files['main.py']='from machine import Pin\nfrom time import ticks_ms,sleep_ms\ns=Pin(5,Pin.IN)\nsequence=[1,1,0,0,0,1,1,0,1]\nwhile True:\n print("DO=%d"%sequence[min(8,ticks_ms()//1000)])\n sleep_ms(100)\n';
  for(const seed of ['5'.repeat(64),'a'.repeat(64),'0123456789abcdef'.repeat(4)])assert((await run(source,p,{root},seed)).points<10);
  const one=await run(await starter(p.taskKey),p,{root},'5'.repeat(64)),two=await run(await starter(p.taskKey),p,{root},'a'.repeat(64));
  assert.equal(one.points,10);assert.equal(two.points,10);assert.notDeepEqual(one.samples.map((s:any)=>s.expected.DO),two.samples.map((s:any)=>s.expected.DO));
  source.files['main.py']='from machine import Pin\nfrom time import sleep_ms\ns=Pin(5,Pin.IN)\nwhile True:\n print("DO=0")\n print("DO=1")\n sleep_ms(100)\n';
  assert.equal((await run(source,p)).points,3);
});
for(const target of ['s3-cpp','uno','nano'] as UrsTarget[])for(const p of analogProfiles)test(`24C ${target} ${p.id}: independent compilation of reference, second solution and criterion-specific wrong source`,{
  skip:!(target==='s3-cpp'?process.env.LAB_S3_COMPILER_TEST:process.env.LAB_GRADING_COMPILER_TEST),timeout:120000},async()=>{
    const variant=p.taskKey.split('/')[1];
    for(const alternative of [false,true]){
      let source=await starter(p.taskKey,target);if(alternative)source=alternateAnalog(source);else source.files['main.ino']+='\n// independently compiled reference\n';
      const r=await run(source,p,compilerOptions(),alternative?'a'.repeat(64):'5'.repeat(64));assert.equal(r.status,'evaluated',JSON.stringify(r));assert.equal(r.points,10,JSON.stringify(r));assert.equal(r.provenance.method,'isolated-source-compilation');
    }
    const wrong=await run(wrongAnalog(await starter(p.taskKey,target),variant),p,compilerOptions());assert.equal(wrong.points,3,JSON.stringify(wrong));
    const later=await run(wrongAnalog(await starter(p.taskKey,target),variant,true),p,compilerOptions());assert.equal(later.points,8,JSON.stringify(later));
    assert.equal((await run(moveAnalogGPIO(await starter(p.taskKey,target)),p,compilerOptions())).points,10,p.id);
    const broken=await starter(p.taskKey,target);if(broken.circuit.kind==='editable')broken.circuit.wires=broken.circuit.wires.filter(w=>![w.from.pin,w.to.pin].some(pin=>['VCC','2','AO','OUT','VRX','DO'].includes(pin)));
    assert.equal((await run(broken,p,compilerOptions())).points,0,p.id);
    if(variant==='sound'){
      const falseOutput=await starter(p.taskKey,target);
      falseOutput.files['main.ino']='void setup(){Serial.begin(9600);pinMode('+(target==='s3-cpp'?5:2)+',INPUT);}void loop(){Serial.println("DO=0");Serial.println("DO=1");delay(100);}';
      assert.equal((await run(falseOutput,p,compilerOptions())).points,3);
    }
});
