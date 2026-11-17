import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {gradeJob} from '../school/grader/official';
import {canonical} from '../school/grader/contract';
import {gradingCoverage,gradingSupport} from '../school/grader/coverage';
import {eventProfiles,starter,jobFor,compilerOptions,alternateEvent,wrongEvent} from './school-events-fixture';
import {decodeNEC} from '../school/grader/events';
import {necEnvelope} from '../public/infrared.mjs';
import type {UrsTarget} from '../src/lessons/ursCatalog';
import {makePart,terminals} from '../src/circuit/model';
const root=process.cwd(),evidence:any[]=[];
async function run(project:any,profile:any,options:any={root},seed='5'.repeat(64)){
  const job=jobFor(project,profile,seed),result=await gradeJob(job,options);
  evidence.push({profileId:profile.id,target:job.target,snapshotHash:job.snapshotHash,seed,contractHash:job.contractHash,result});return result;
}
test.after(()=>{mkdirSync('docs/stage24e-evidence',{recursive:true});writeFileSync('docs/stage24e-evidence/events-'+(process.env.LAB_EVENT_TARGET??'all')+'.json',JSON.stringify({format:'labosv2-event-evidence',version:1,sourceCommit:process.env.GITHUB_SHA??null,results:evidence},null,2)+'\n');});
test('24E publishes six contracts, preserves previous profiles and adds exactly 24 combinations',()=>{
  const registry=JSON.parse(readFileSync('school/grader/profiles.json','utf8'));
  assert.equal(eventProfiles.length,6);assert.deepEqual(registry.profiles.slice(0,27),JSON.parse(readFileSync('verification/fixtures/24d-grading-profiles.json','utf8')).profiles);
  // A newer version may replace the active profile without removing its task/target coverage.
  const preservedCombinations=new Set(registry.profiles.slice(0,33).flatMap((p:any)=>p.targets.map((t:string)=>p.taskKey+'/'+t)));
  assert.equal(preservedCombinations.size,104);
  const supportedCombinations=new Set(gradingCoverage('test').rows.filter(r=>r.grading.status==='supported').map(r=>r.id));
  for(const combination of preservedCombinations)assert(supportedCombinations.has(combination as string),String(combination));
  for(const p of eventProfiles){assert.equal(p.criteria.reduce((n,c)=>n+c.maxPoints,0),10);assert.equal(p.contract!.scenarioVersion,'24E.1');
    for(const t of p.targets)assert.equal(gradingSupport(p.taskKey,t).profileId,p.id);
  }
});
test('24E envelope observer independently rejects inverse/timing faults and decodes repeat',()=>{
  const trace=(fault='none',repeat=false)=>{let timeUs=0;const edges=necEnvelope(18,255,repeat,fault).map((e:any)=>{const v={timeUs,level:e.level};timeUs+=e.durationUs;return v;});return [...edges,{timeUs,level:1}];};
  assert.deepEqual(decodeNEC(trace()).map(f=>[f.address,f.command,f.repeat]),[[18,255,false]]);
  assert.deepEqual(decodeNEC(trace('inverse')),[]);assert.deepEqual(decodeNEC(trace('timing')),[]);assert.equal(decodeNEC(trace('none',true))[0].repeat,true);
});
for(const target of ['micropython','s3-cpp','uno','nano'] as UrsTarget[])test(`24E ${target}: all six actual programs and three repeatable runs`,{
  skip:!!process.env.LAB_EVENT_TARGET&&process.env.LAB_EVENT_TARGET!==target,timeout:600000},async()=>{
  for(const p of eventProfiles){let expected:string|undefined;
    for(let repetition=0;repetition<3;repetition++){
      const project=await starter(p.taskKey,target);project.files['forged-results.json']='{"points":999,"authority":"server-verified"}';
      const r=await run(project,p);assert.equal(r.status,'evaluated',JSON.stringify(r));assert.equal(r.points,10,JSON.stringify(r));
      if(expected)assert.equal(canonical(r.samples),expected,p.id);else expected=canonical(r.samples);
    }
  }
});
test('24E alternate MicroPython algorithms, identifiers and layouts accept new private inputs',{skip:!!process.env.LAB_EVENT_TARGET&&process.env.LAB_EVENT_TARGET!=='micropython',timeout:120000},async()=>{
  for(const p of eventProfiles){const r=await run(alternateEvent(await starter(p.taskKey)),p,{root},'a'.repeat(64));assert.equal(r.points,10,JSON.stringify(r));}
});
test('24E every criterion has an intentional negative and exact partial score',{skip:!!process.env.LAB_EVENT_TARGET&&process.env.LAB_EVENT_TARGET!=='micropython',timeout:180000},async()=>{
  for(const p of eventProfiles){
    const variant=p.taskKey.split('/')[1],none=await run(wrongEvent(await starter(p.taskKey),variant),p);
    assert.equal(none.points,3,JSON.stringify(none));assert.deepEqual(none.criteria.map((r:any)=>r.points),[3,0,0]);
    const late=await run(wrongEvent(await starter(p.taskKey),variant,true),p);assert.equal(late.points,8,JSON.stringify(late));assert.deepEqual(late.criteria.map((r:any)=>r.points),[3,5,0]);
    const broken=await starter(p.taskKey);if(broken.circuit.kind==='editable')broken.circuit.wires=broken.circuit.wires.filter(w=>![w.from.pin,w.to.pin].includes('GND'));
    assert.equal((await run(broken,p)).points,0,p.id);
  }
});
test('24E slow polling, swapped phases, forged reports and disconnected optical paths lose points',{skip:!!process.env.LAB_EVENT_TARGET&&process.env.LAB_EVENT_TARGET!=='micropython',timeout:120000},async()=>{
  for(const p of eventProfiles){const project=await starter(p.taskKey),j=jobFor(project,p);
    for(const patch of [{contractHash:'0'.repeat(64)},{snapshotHash:'0'.repeat(64)},{rubric:{...j.rubric,instructions:'Izmijenjeno'}},{checkerVersion:'24D.1'},{target:'other'}]){
      const r=await gradeJob({...j,...patch},{root});assert.equal(r.status,'unsupported');assert.equal(r.points,null);
    }
    if(p.taskKey.startsWith('encoder/')){
      project.files['main.py']=project.files['main.py'].replaceAll('sleep_ms(1)','sleep_ms(250)');assert((await run(project,p)).points<10,p.id);
    }else if(project.circuit.kind==='editable'){
      project.circuit.components.find(c=>c.kind==='irReceiver')!.properties.irChannel=2;
      assert.equal((await run(project,p)).points,0,p.id);
    }
  }
  const p=eventProfiles.find(p=>p.taskKey==='encoder/ky040')!,swapped=await starter(p.taskKey);
  swapped.files['main.py']=swapped.files['main.py'].replace('Pin(4, Pin.IN), Pin(5, Pin.IN)','Pin(5, Pin.IN), Pin(4, Pin.IN)');
  assert.equal((await run(swapped,p)).points,3);
});
test('24E LED accepts GPIO endpoints and follows only the electrically connected duty source',{skip:!!process.env.LAB_EVENT_TARGET&&process.env.LAB_EVENT_TARGET!=='micropython',timeout:45000},async()=>{
  const profile=eventProfiles.find(p=>p.taskKey==='ir/irLED')!,endpoints=await starter(profile.taskKey);
  endpoints.files['main.py']=endpoints.files['main.py'].replace(/(^[ \t]*)led.duty_u16\(svjetlina \* 65535 \/\/ 100\)/m,(_line,indent)=>
    indent+'if svjetlina == 0 or svjetlina == 100:\n'+indent+'    led.deinit()\n'+indent+'    Pin(7, Pin.OUT).value(1 if svjetlina else 0)\n'+indent+'else:\n'+indent+'    led.init(duty_u16=svjetlina * 65535 // 100)');
  assert.equal((await run(endpoints,profile)).points,10);
  const unrelated=await starter(profile.taskKey);assert.equal(unrelated.circuit.kind,'editable');
  if(unrelated.circuit.kind!=='editable')throw Error('Expected editable circuit');
  const c=unrelated.circuit,b=c.components.find(p=>p.kind==='board')!,pins=terminals(b),pin=(n:number)=>pins.find(t=>t.gpio===n)!.pin;
  for(const w of c.wires)for(const e of [w.from,w.to])if(e.component===b.id&&e.pin===pin(7))e.pin=pin(10);
  const r=makePart('resistor',600,600,'unrelated-pwm-load');r.properties.resistance=680;c.components.push(r);
  c.wires.push({id:'fake-pwm',from:{component:b.id,pin:pin(7)},to:{component:r.id,pin:'1'},color:'#087f8c',points:[]},
    {id:'fake-ground',from:{component:r.id,pin:'2'},to:{component:b.id,pin:pins.find(t=>t.role==='ground')!.pin},color:'#334155',points:[]});
  unrelated.files['main.py']=unrelated.files['main.py'].replace('svjetlina = 0','gate = Pin(10, Pin.OUT, value=0)\nsvjetlina = 0').replace('led.duty_u16(svjetlina * 65535 // 100)','led.duty_u16(svjetlina * 65535 // 100)\n                gate.value(1 if svjetlina else 0)');
  assert.equal((await run(unrelated,profile)).points,3);
});
for(const target of ['s3-cpp','uno','nano'] as UrsTarget[])for(const p of eventProfiles)test(`24E ${target} ${p.id}: independent reference, alternate and wrong source compilation`,{
  skip:(!!process.env.LAB_EVENT_TARGET&&process.env.LAB_EVENT_TARGET!==target)||!(target==='s3-cpp'?process.env.LAB_S3_COMPILER_TEST:process.env.LAB_GRADING_COMPILER_TEST),timeout:300000},async()=>{
  for(const alternative of [false,true]){
    let project=await starter(p.taskKey,target);if(alternative)project=alternateEvent(project);else project.files['main.ino']+='\n// independent event checker source build\n';
    const r=await run(project,p,compilerOptions(),alternative?'a'.repeat(64):'5'.repeat(64));assert.equal(r.status,'evaluated',JSON.stringify(r));assert.equal(r.points,10,JSON.stringify(r));assert.equal(r.provenance.method,'isolated-source-compilation');
  }
  const r=await run(wrongEvent(await starter(p.taskKey,target),p.taskKey.split('/')[1]),p,compilerOptions());assert.equal(r.points,3,JSON.stringify(r));
});
