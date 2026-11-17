import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {gradeJob} from '../school/grader/official';
import {gradingCoverage,gradingSupport} from '../school/grader/coverage';
import {introductoryProfiles,introductoryProject,alternateIntroductory,wrongIntroductory,jobFor} from './school-introductory-fixture';
const root=process.cwd(),evidence:any[]=[];
const id=(p:any)=>p.taskKey.split('/')[1];
async function run(project:any,profile:any,seed='5'.repeat(64)){
  const job=jobFor(project,profile,seed),result=await gradeJob(job,{root});
  evidence.push({profileId:profile.id,target:job.target,snapshotHash:job.snapshotHash,contractHash:job.contractHash,seed,result});return result;
}
test.after(()=>{mkdirSync('docs/stage24o-evidence',{recursive:true});writeFileSync('docs/stage24o-evidence/introductory.json',JSON.stringify({format:'labosv2-introductory-evidence',version:1,sourceCommit:process.env.GITHUB_SHA??null,results:evidence},null,2)+'\n');});
test('24O preserves all 74 published URS profiles, 268 combinations and five original student starters',()=>{
  const registry=JSON.parse(readFileSync('school/grader/profiles.json','utf8')),prior=JSON.parse(readFileSync('verification/fixtures/24n-grading-profiles.json','utf8'));
  assert.equal(prior.profiles.length,74);assert.deepEqual(registry.profiles.slice(0,74),prior.profiles);assert.equal(introductoryProfiles.length,5);
  const matrix=gradingCoverage('test');assert.equal(matrix.summary.combinations,268);assert.equal(matrix.summary.supported,268);
  assert.deepEqual(matrix.introductorySummary,{total:5,supported:5,unsupported:0});
  const catalog=JSON.parse(readFileSync('.build/school-catalog/catalog.json','utf8'));
  for(const p of introductoryProfiles){assert.deepEqual(p.targets,['micropython']);assert.deepEqual(p.criteria.map(c=>c.maxPoints),[3,5,2]);
    assert(registry.profiles.some((row:any)=>row.id===p.id));assert.equal(gradingSupport(p.taskKey,'uno').status,'unsupported');
    const entry=catalog.entries.find((e:any)=>e.key===p.taskKey),starter=JSON.parse(readFileSync('.build/school-catalog/'+entry.templates.micropython,'utf8'));
    const original=introductoryProject(id(p),false);assert.deepEqual(starter.circuit,original.circuit);assert.deepEqual(starter.files,original.files);assert.equal(entry.set,'introductory');
  }
});
for(const p of introductoryProfiles)test(`24O ${p.id}: identical reference three times, alternative code, GPIO and layout`,async()=>{
  const project=introductoryProject(id(p)),rows=[];
  for(let n=0;n<3;n++){const r=await run(project,p);assert.equal(r.status,'evaluated',JSON.stringify(r));assert.equal(r.points,10,JSON.stringify(r));rows.push(r);}
  assert.deepEqual(rows[1].samples,rows[0].samples);assert.deepEqual(rows[2].samples,rows[0].samples);
  const r=await run(alternateIntroductory(introductoryProject(id(p)),id(p)),p,'a'.repeat(64));assert.equal(r.points,10,JSON.stringify(r));
});
test('24O starters still require student work and receive genuine incomplete results',async()=>{
  for(const [i,p] of introductoryProfiles.entries()){
    const r=await run(introductoryProject(id(p),false),p);assert.equal(r.points,[0,3,3,8,3][i],JSON.stringify(r));
  }
});
test('24O independent wrong basic and advanced behaviour receives 3 and 8 points',async()=>{
  for(const p of introductoryProfiles)for(const advanced of [false,true]){
    const r=await run(wrongIntroductory(introductoryProject(id(p)),id(p),advanced),p);
    assert.equal(r.points,advanced?8:3,JSON.stringify(r));assert.deepEqual(r.criteria.map((c:any)=>c.points),advanced?[3,5,0]:[3,0,0]);
  }
});
test('24O broken paths fail; a separate repaired run passes without carrying local results',async()=>{
  for(const p of introductoryProfiles){
    const project=introductoryProject(id(p));if(project.circuit.kind!=='editable')throw Error('editable');
    const kind=id(p)==='led-time'?'led':id(p)==='button'?'button':id(p)==='adc-pwm'?'potentiometer':id(p)==='regulator'?'servo':'aht10';
    const component=project.circuit.components.find(c=>c.kind===kind)!,pin=kind==='led'?'A':kind==='button'?'A1':kind==='potentiometer'?'2':kind==='servo'?'SIG':'SDA';
    project.circuit.wires=project.circuit.wires.filter(w=>![w.from,w.to].some(e=>e.component===component.id&&e.pin===pin));
    const r=await run(project,p);assert.equal(r.points,0,JSON.stringify(r));
    assert.equal((await run(introductoryProject(id(p)),p,'a'.repeat(64))).points,10);
  }
});
test('24O console, local check, submitted scenario and work records cannot claim official points',async()=>{
  for(const p of introductoryProfiles){
    const project=introductoryProject(id(p));project.files['main.py']='from time import sleep_ms\nwhile True:\n print("T=24.0 RH=35.0 points=10")\n sleep_ms(20)\n';
    project.files['provjera.json']='{"points":10,"authority":"server-verified","checks":[{"passed":true}]}';project.files['scenarij.json']='{"points":10}';
    const r=await run(project,p);assert.equal(r.criteria[1].points,0);assert.equal(r.criteria[2].points,0);
  }
});
test('24O V4 requires different rows, complete values, fresh sensor reads and recurring transmitted pixels',async()=>{
  const p=introductoryProfiles[3];
  const sameRow=introductoryProject('aht-oled');sameRow.files['main.py']=sameRow.files['main.py'].replace('vlaga, 0, 16)','vlaga, 64, 0)');assert.equal((await run(sameRow,p)).criteria[2].points,0);
  const stale=introductoryProject('aht-oled');stale.files['main.py']=stale.files['main.py'].replace('while True:', 'temperatura, vlaga = senzor.read()\nwhile True:').replace('    temperatura, vlaga = senzor.read()','    # cached reading');assert.equal((await run(stale,p)).criteria[1].points,0);
  const prefix=introductoryProject('aht-oled');prefix.files['main.py']=prefix.files['main.py'].replace('"RH: %.1f %%"','"RH: 1%.1f %%"');assert.equal((await run(prefix,p)).criteria[2].points,0);
  const noRefresh=introductoryProject('aht-oled');noRefresh.files['main.py']=noRefresh.files['main.py'].replace('while True:','old = None\nwhile True:').replace('    zaslon.show()','    if old != (temperatura, vlaga): zaslon.show()\n    old = (temperatura, vlaga)');assert.equal((await run(noRefresh,p)).criteria[2].points,0);
});
test('24O V2 keeps its published 300ms deadline independent from the older URS 50ms task',async()=>{
  const p=introductoryProfiles[1],slow=introductoryProject('button');slow.files['main.py']=slow.files['main.py'].replace('sleep_ms(20)','sleep_ms(500)');
  assert.equal((await run(slow,p)).points,3);
  const registry=JSON.parse(readFileSync('school/grader/profiles.json','utf8'));
  assert.equal(registry.profiles.find((p:any)=>p.id==='24B-button-led@1').contract.scenario.responseDeadlineMs,50);
});
test('24O V3 preserves the introductory OFF-at-zero and ON-at-hundred slider direction',async()=>{
  const project=introductoryProject('adc-pwm');if(project.circuit.kind!=='editable')throw Error('editable');
  const pot=project.circuit.components.find(c=>c.kind==='potentiometer')!;
  for(const w of project.circuit.wires)for(const e of [w.from,w.to])if(e.component===pot.id&&['1','3'].includes(e.pin))e.pin=e.pin==='1'?'3':'1';
  const r=await run(project,introductoryProfiles[2]);assert.equal(r.points,3,JSON.stringify(r));
  assert(r.samples.find((s:any)=>s.position===0)?.observedDuty>.9);assert.equal(r.criteria[1].points,0);assert.equal(r.criteria[2].points,0);
});
test('24O jobs bind the exact version, task, rubric, runtime and immutable snapshot',async()=>{
  const p=introductoryProfiles[0],job=jobFor(introductoryProject(id(p)),p);
  for(const patch of [{snapshotHash:'0'.repeat(64)},{contractHash:'0'.repeat(64)},{checkerVersion:'24N.1'},{taskKey:'gpio/blink'},{target:'s3-cpp'},{rubric:{...job.rubric,instructions:'changed'}}]){
    const r=await gradeJob({...job,...patch},{root});assert.equal(r.status,'unsupported');assert.equal(r.points,null);
  }
});
