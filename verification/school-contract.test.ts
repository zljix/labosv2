import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {gradeJob} from '../school/grader/official';
import {canonical,contractDigest} from '../school/grader/contract';
import {profiles,starter,solution,jobFor,compilerOptions} from './school-contract-fixture';
const root=process.cwd(),evidence:any[]=[];
async function run(job:any,options:any={root}){const r=await gradeJob(job,options);evidence.push({profile:job.profileId,target:job.target,seed:job.seed,snapshotHash:job.snapshotHash,contractHash:job.contractHash,result:r});return r;}
test.after(()=>{mkdirSync('docs/stage24ab-evidence',{recursive:true});writeFileSync('docs/stage24ab-evidence/contract-results.json',JSON.stringify({format:'labosv2-contract-evidence',version:1,results:evidence},null,2)+'\n');});

test('24A published legacy profile bytes are preserved; every new profile freezes a full execution contract',()=>{
  const old=JSON.parse(readFileSync('school/grader/profiles.json','utf8')).profiles.slice(0,6);
  assert.equal(profiles.length,6);assert.deepEqual(old,JSON.parse(readFileSync('verification/fixtures/legacy-grading-profiles.json','utf8')).profiles);
  for(const p of profiles){assert.deepEqual(p.targets,['micropython','s3-cpp','uno','nano']);assert.equal(p.criteria.reduce((n,c)=>n+c.maxPoints,0),10);assert(p.contract);assert.equal(p.contract.limits.outputBytes,1048576);}
  assert.equal(contractDigest({a:1,b:[{d:2,c:3}]}),contractDigest({b:[{c:3,d:2}],a:1}));
  assert.notEqual(contractDigest([1,2]),contractDigest([2,1]));
});
test('24A six MicroPython rubrics: two valid implementations, equivalent layouts, three repeatable runs',{timeout:120000},async()=>{
  for(const p of profiles){
    const source=solution(await starter(p.taskKey),p),j=jobFor(source,p);let first:any;
    for(let repetition=0;repetition<3;repetition++){
      const r=await run(j);assert.equal(r.status,'evaluated',JSON.stringify(r));assert.equal(r.points,10,JSON.stringify(r));
      if(first)assert.equal(canonical(r.samples),canonical(first.samples));else first=r;
      assert.equal(r.jobId,j.jobId);assert.equal(r.revision,j.revision);assert.equal(r.contractHash,j.contractHash);
    }
    const alternate=solution(await starter(p.taskKey),p,true),r=await run(jobFor(alternate,p,'a'.repeat(64)));
    assert.equal(r.points,10,JSON.stringify(r));
    if(p.kind!=='blink'&&p.kind!=='button')assert.notDeepEqual(first.samples,r.samples);
  }
});
test('24A wrong programs, connection, repetition, deadline and exact ADC boundary lose their criteria',{timeout:120000},async()=>{
  for(const p of profiles){
    const broken=solution(await starter(p.taskKey),p);
    if(broken.circuit.kind==='editable')broken.circuit.wires=broken.circuit.wires.filter(w=>![w.from.pin,w.to.pin].includes(p.kind==='sensor'?'SDA':p.kind==='lm35'?'OUT':'A'));
    assert.equal((await run(jobFor(broken,p))).points,0,p.id);
    const fixed=solution(await starter(p.taskKey),p);
    fixed.files['main.py']=p.kind==='button'||p.kind==='analog'?'from machine import Pin\nfrom time import sleep_ms\nled=Pin(4,Pin.OUT,value=0)\nwhile True:\n sleep_ms(10)\n':
      p.kind==='blink'?'from machine import Pin\nfrom time import sleep_ms\nled=Pin(4,Pin.OUT,value=1)\nwhile True:\n sleep_ms(10)\n':
      'from time import sleep_ms\nwhile True:\n print("T=25 P=100000")\n sleep_ms(100)\n';
    const r=await run(jobFor(fixed,p));assert.equal(r.criteria[1].points,0,JSON.stringify(r));assert.equal(r.criteria[2].points,0,JSON.stringify(r));
  }
  for(const p of profiles.filter(p=>['analog','blink'].includes(p.kind))){
    const wrong=solution(await starter(p.taskKey),p);
    wrong.files['main.py']=wrong.files['main.py'].replace('>=2048','>2048').replace('sleep_ms(250)','sleep_ms(500)').replace('sleep_ms(750)','sleep_ms(500)');
    const r=await run(jobFor(wrong,p));assert.equal(r.points,8,JSON.stringify(r));assert.equal(r.criteria[2].points,0);
  }
  const p=profiles[0],slow=solution(await starter(p.taskKey),p);slow.files['main.py']=slow.files['main.py'].replace('sleep_ms(20)','sleep_ms(200)');
  const r=await run(jobFor(slow,p));assert.equal(r.criteria[1].points,0,JSON.stringify(r));
});
test('24A changed source, instructions, contract, target, identity or profile never inherits a valid result',{timeout:30000},async()=>{
  const p=profiles[0],j=jobFor(solution(await starter(p.taskKey),p),p);
  for(const change of [{projectJson:j.projectJson+' '},{version:1},{checkerVersion:'23E.1'},{taskKey:'gpio/blink'},{jobId:0},{attemptId:-1},{revision:0},{target:'unknown'},{contractHash:'0'.repeat(64)},{rubricDigest:'0'.repeat(64)},
    {rubric:{...j.rubric,instructions:'Izmijenjeno'}},{rubric:{...j.rubric,contract:{...j.rubric.contract,scenarioVersion:'other'}}}]){
    const r=await run({...j,...change});assert.equal(r.status,'unsupported',JSON.stringify(change));assert.equal(r.points,null);
  }
  const reordered=JSON.parse(JSON.stringify(j));reordered.rubric.criteria=reordered.rubric.criteria.map((c:any)=>({maxPoints:c.maxPoints,description:c.description,id:c.id}));
  assert.equal((await run(reordered)).points,10);
  const busy=solution(await starter(p.taskKey),p);busy.files['main.py']='while True:\n pass\n';
  const r=await run(jobFor(busy,p),{root,timeoutMs:700});assert.equal(r.status,'execution_limit');assert.equal(r.points,null);assert.equal(r.jobId,7);
});
test('24A failure confined to the later scenario loses only its two repetition points',{timeout:30000},async()=>{
  for(const p of profiles.filter(p=>['button','lm35','sensor'].includes(p.kind))){
    const source=solution(await starter(p.taskKey),p);
    if(p.kind==='button')source.files['main.py']='from machine import Pin\nfrom time import sleep_ms,ticks_ms\nb=Pin(5,Pin.IN,Pin.PULL_UP)\nl=Pin(4,Pin.OUT)\nwhile True:\n l.value(not b.value() if ticks_ms()<750 else 0)\n sleep_ms(15)\n';
    else if(p.kind==='lm35')source.files['main.py']='from machine import Pin,ADC\nfrom time import sleep_ms,ticks_ms\na=ADC(Pin(1),atten=ADC.ATTN_11DB)\nwhile True:\n t=a.read_uv()/10000\n print("T=%.2f"%(t if ticks_ms()<2000 else 0))\n sleep_ms(200)\n';
    else source.files['main.py']='from time import ticks_ms\n'+source.files['main.py'].replace('while True:\n','while True:\n    if ticks_ms()>=10000:\n        sleep_ms(1000)\n        continue\n');
    const r=await run(jobFor(source,p));assert.equal(r.points,8,JSON.stringify(r));assert.equal(r.criteria[2].points,0);
  }
});
test('24B S3 exact trusted source ignores forged and modified incoming WASM; changed source requires compilation',{timeout:120000},async()=>{
  for(const p of profiles.filter(p=>!['blink','analog'].includes(p.kind))){
    const source=await starter(p.taskKey,'s3-cpp');source.files['s3-build.json']='{"wasm":"FORGED","points":99}';
    const r=await run(jobFor(source,p));assert.equal(r.status,'evaluated',JSON.stringify(r));assert.equal(r.points,10,JSON.stringify(r));assert.equal(r.provenance.method,'trusted-catalogue-exact-source');
    source.files['main.ino']+='\n// changed source\n';const changed=await run(jobFor(source,p));assert.equal(changed.status,'unsupported');assert.equal(changed.points,null);
  }
});
test('24B all six S3 rubrics compile the saved source independently, including second implementations and wrong solutions',{
  skip:!process.env.LAB_S3_COMPILER_TEST,timeout:300000},async()=>{
  for(const p of profiles){
    for(const alternate of [false,true]){
      const source=solution(await starter(p.taskKey,'s3-cpp'),p,alternate);source.files['s3-build.json']='{"wasm":"FORGED"}';
      const r=await run(jobFor(source,p,alternate?'a'.repeat(64):'5'.repeat(64)),compilerOptions());
      assert.equal(r.status,'evaluated',JSON.stringify(r));assert.equal(r.points,10,JSON.stringify(r));assert.equal(r.provenance.method,'isolated-source-compilation');assert.match(r.provenance.compilerIdentity.clang,/^[a-f0-9]{64}$/);
      if(!alternate)for(let repeat=0;repeat<2;repeat++){
        const repeated=await run(jobFor(source,p),compilerOptions());assert.equal(repeated.points,10,JSON.stringify(repeated));assert.equal(canonical(repeated.samples),canonical(r.samples));
      }
    }
    const broken=solution(await starter(p.taskKey,'s3-cpp'),p);broken.files['main.ino']='void setup(){}void loop(){delay(10);}';
    const r=await run(jobFor(broken,p),compilerOptions());assert.equal(r.status,'evaluated',JSON.stringify(r));assert.notEqual(r.points,10);
  }
  const p=profiles[0],syntax=solution(await starter(p.taskKey,'s3-cpp'),p);syntax.files['main.ino']='invalid syntax';
  assert.equal((await run(jobFor(syntax,p),compilerOptions())).status,'program_error');
  const r=await run(jobFor(solution(await starter(p.taskKey,'s3-cpp'),p),p),{...compilerOptions(),clang:'/missing/clang'});
  assert.equal(r.status,'technical_error');assert.equal(r.points,null);
});
test('24B correct fast polling stays inside the same contract without losing observations',{
  skip:!process.env.LAB_S3_COMPILER_TEST,timeout:30000},async()=>{
  const p=profiles[0],source=solution(await starter(p.taskKey,'s3-cpp'),p);
  source.files['main.ino']=source.files['main.ino'].replace('delay(20);','');
  const r=await run(jobFor(source,p),compilerOptions());assert.equal(r.status,'evaluated',JSON.stringify(r));assert.equal(r.points,10);
});
test('24AB all six Uno/Nano contracts compile reference and alternate saved sources',{
  skip:!process.env.LAB_GRADING_COMPILER_TEST,timeout:300000},async()=>{
  for(const target of ['uno','nano'] as const)for(const p of profiles)for(const alternate of [false,true]){
    const source=solution(await starter(p.taskKey,target),p,alternate);source.files['main.ino']+='\n// Contract source compilation\n';
    const r=await run(jobFor(source,p),compilerOptions());assert.equal(r.status,'evaluated',JSON.stringify(r));assert.equal(r.points,10,JSON.stringify(r));
  }
});
