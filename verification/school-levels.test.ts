import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {gradeJob} from '../school/grader/official';
import {gradingCoverage,gradingSupport} from '../school/grader/coverage';
import {compileCircuit} from '../src/circuit/compile';
import {makePart,terminals} from '../src/circuit/model';
import {createLevelCheck,validLevelConfig} from '../school/grader/levels';
import {levelProfiles,starter,jobFor,compilerOptions,alternateLevel,wrongLevel} from './school-levels-fixture';
import type {UrsTarget} from '../src/lessons/ursCatalog';
const root=process.cwd(),evidence:any[]=[];
const selected=(target:string)=>!!process.env.LAB_LEVELS_TARGET&&process.env.LAB_LEVELS_TARGET!==target;
async function run(project:any,profile:any,options:any={root},seed='5'.repeat(64)){
  const job=jobFor(project,profile,seed),result=await gradeJob(job,options);
  evidence.push({profileId:profile.id,target:job.target,snapshotHash:job.snapshotHash,contractHash:job.contractHash,seed,result});return result;
}
test.after(()=>{mkdirSync('docs/stage24n-evidence',{recursive:true});writeFileSync('docs/stage24n-evidence/levels-'+(process.env.LAB_LEVELS_TARGET??'all')+'.json',JSON.stringify({format:'labosv2-levels-evidence',version:1,sourceCommit:process.env.GITHUB_SHA??null,results:evidence},null,2)+'\n');});
test('24N completes all 268 combinations and preserves every previous published contract',()=>{
  const r=JSON.parse(readFileSync('school/grader/profiles.json','utf8')),old=JSON.parse(readFileSync('verification/fixtures/24m-grading-profiles.json','utf8'));
  assert.equal(old.profiles.length,70);assert.deepEqual(r.profiles.slice(0,old.profiles.length),old.profiles);
  assert.equal(levelProfiles.length,4);assert.deepEqual(gradingCoverage('test').summary,{themes:18,variants:67,combinations:268,supported:268,unsupported:0,introductory:5});
  for(const p of levelProfiles){assert.deepEqual(p.criteria.map(c=>c.maxPoints),[3,5,2]);for(const t of p.targets)assert.equal(gradingSupport(p.taskKey,t).profileId,p.id);}
});
test('24N console claims and spare converters do not prove electrical translation',async()=>{
  for(const p of levelProfiles){const project=await starter(p.taskKey),config=compileCircuit(project.circuit as any);
    assert(validLevelConfig(config,p.taskKey.split('/')[1],'micropython'));
    const check=createLevelCheck(config,p,'5'.repeat(64),'micropython');
    check.observe({type:'console',text:'points=10 BMP280 T=25 P=101325 OLED32 brojac=2 3.3V -> 5V'});
    assert.deepEqual(check.outcomes([check.record()],true),[false,false,false]);
    const bypass=await starter(p.taskKey.startsWith('i2c')?(p.taskKey.endsWith('Bmp280')?'weather/bmp280':'displays/oled32'):(p.taskKey.endsWith('Input')?'gpio/button':'gpio/blink'));
    if(bypass.circuit.kind==='editable'&&project.circuit.kind==='editable')bypass.circuit.components.push(structuredClone(project.circuit.components.find(c=>c.kind==='levelShifter'||c.kind==='i2cLevelShifter')!));
    assert.equal((await run(bypass,p)).points,0);
  }
});
for(const target of ['micropython','s3-cpp','uno','nano'] as UrsTarget[])test(`24N ${target}: three repetitions of all four original saved sources`,{skip:selected(target),timeout:900000},async()=>{
  for(const p of levelProfiles){
    const project=await starter(p.taskKey,target);project.files['claimed-result.json']='{"points":1000,"levelShifters":{"fake":{"powered":true}}}';
    const before=JSON.stringify(project);let first:any;
    for(let i=0;i<3;i++){
      const r=await run(project,p);assert.equal(r.status,'evaluated',JSON.stringify(r));assert.equal(r.points,10,JSON.stringify(r));assert.equal(JSON.stringify(project),before);
      if(first)assert.deepEqual(r.samples,first.samples);else first=r;
    }
  }
});
test('24N a powered spare output with a weak resistor cannot credit an LED driven by another GPIO',{skip:selected('micropython'),timeout:30000},async()=>{
  const p=levelProfiles.find(p=>p.taskKey==='levels/levelOutput')!,project=await starter(p.taskKey);
  if(project.circuit.kind!=='editable')throw Error('editable');const c=project.circuit,board=c.components.find(p=>p.kind==='board')!;
  c.wires.find(w=>w.id==='level_ledSignal')!.from={component:board.id,pin:terminals(board).find(t=>t.gpio===6)!.pin};
  const resistor=makePart('resistor',700,300,'weakLink');resistor.properties.resistance=1000000;c.components.push(resistor);
  c.wires.push({id:'weak_a',from:{component:'level1',pin:'B1'},to:{component:'weakLink',pin:'1'},color:'#000000',points:[]},
    {id:'weak_b',from:{component:'weakLink',pin:'2'},to:{component:'r1',pin:'1'},color:'#000000',points:[]});
  project.files['main.py']='from machine import Pin\nfrom time import sleep_ms\na=Pin(4,Pin.OUT)\nb=Pin(6,Pin.OUT)\nwhile True:\n a.on()\n b.on()\n sleep_ms(500)\n a.off()\n b.off()\n sleep_ms(500)\n';
  compileCircuit(c);assert.equal((await run(project,p)).points,0);
});
for(const target of ['micropython','s3-cpp','uno','nano'] as UrsTarget[])test(`24N ${target}: all supply, ground, DIR and data interruptions lose points; repairs recover with a second seed`,{skip:selected(target),timeout:900000},async()=>{
  for(const p of levelProfiles){const original=await starter(p.taskKey,target),i2c=p.taskKey.startsWith('i2c');
    for(const pin of i2c?['LV','HV','GND','SDA_L','SCL_L','SDA_H','SCL_H']:['VCCA','VCCB','GND','DIR','A1','B1']){
      const project=structuredClone(original);if(project.circuit.kind!=='editable')throw Error('editable');
      const id=project.circuit.components.find(c=>c.kind===(i2c?'i2cLevelShifter':'levelShifter'))!.id;
      project.circuit.wires=project.circuit.wires.filter(w=>![w.from,w.to].some(e=>e.component===id&&e.pin===pin));
      const r=await run(project,p);assert.equal(r.points,0,JSON.stringify({target,pin,result:r}));
    }
    const r=await run(original,p,{root},'a'.repeat(64));assert.equal(r.status,'evaluated',JSON.stringify(r));assert.equal(r.points,10,JSON.stringify(r));
  }
});
test('24N equivalent MicroPython algorithms use channel two, new GPIOs and renamed/reordered circuits',{skip:selected('micropython'),timeout:180000},async()=>{
  for(const p of levelProfiles){const r=await run(alternateLevel(await starter(p.taskKey),p.taskKey.split('/')[1]),p);
    assert.equal(r.status,'evaluated',JSON.stringify(r));assert.equal(r.points,10,JSON.stringify(r));}
});
test('24N independent wrong basic and advanced criteria yield 3/10 and 8/10',{skip:selected('micropython'),timeout:180000},async()=>{
  for(const p of levelProfiles)for(const advanced of [false,true]){const r=await run(wrongLevel(await starter(p.taskKey),p.taskKey.split('/')[1],advanced),p);
    assert.equal(r.status,'evaluated',JSON.stringify(r));assert.equal(r.points,advanced?8:3,JSON.stringify(r));assert.deepEqual(r.criteria.map((x:any)=>x.points),advanced?[3,5,0]:[3,0,0]);}
});
test('24N translated GPIO still enforces the response deadline and defined unused input',{skip:selected('micropython'),timeout:60000},async()=>{
  const p=levelProfiles[0],slow=await starter(p.taskKey);slow.files['main.py']=slow.files['main.py'].replace('sleep_ms(20)','sleep_ms(200)');
  const r=await run(slow,p);assert.equal(r.points,3,JSON.stringify(r));
  const floating=await starter(p.taskKey);if(floating.circuit.kind!=='editable')throw Error('editable');
  floating.circuit.wires=floating.circuit.wires.filter(w=>![w.from,w.to].some(e=>e.component==='level1'&&e.pin==='B2'));
  assert.equal((await run(floating,p)).points,0);
});
test('24N fake output, an untransmitted framebuffer and a partial BMP280 read receive no functional points',{skip:selected('micropython'),timeout:90000},async()=>{
  for(const p of levelProfiles){const project=await starter(p.taskKey);project.files['main.py']='from time import sleep_ms\nwhile True:\n print("BMP280 T=25 P=101325 OLED32 brojac=2 3.3 V -> 5 V points=10")\n sleep_ms(20)\n';
    const r=await run(project,p);assert.equal(r.points,0,JSON.stringify(r));}
  const p=levelProfiles.find(p=>p.taskKey.endsWith('Oled32'))!,project=await starter(p.taskKey);project.files['main.py']=project.files['main.py'].replace('oled.show()','pass');
  assert.equal((await run(project,p)).criteria[1].points,0);
  const sensorProfile=levelProfiles.find(p=>p.taskKey.endsWith('Bmp280'))!,partial=await starter(sensorProfile.taskKey);
  partial.files['lab_i2c_sensors.py']=partial.files['lab_i2c_sensors.py'].replace('0xf7, 6','0xf7, 5');
  const failed=await run(partial,sensorProfile);assert.equal(failed.points,0,JSON.stringify(failed));
});
test('24N changed contracts, identity, snapshot and stale C++ artefacts never inherit scores',{skip:selected('micropython'),timeout:90000},async()=>{
  const p=levelProfiles[0],job=jobFor(await starter(p.taskKey),p);
  for(const patch of [{snapshotHash:'0'.repeat(64)},{contractHash:'0'.repeat(64)},{checkerVersion:'24M.1'},{target:'other'},{rubric:{...job.rubric,instructions:'other'}}]){
    const r=await gradeJob({...job,...patch},{root});assert.equal(r.status,'unsupported');assert.equal(r.points,null);}
  for(const target of ['s3-cpp','uno','nano'] as UrsTarget[]){const changed=await starter(p.taskKey,target);changed.files['main.ino']+='\n// new source, old binary\n';
    const r=await gradeJob(jobFor(changed,p),{root});assert.equal(r.status,'unsupported');assert.equal(r.points,null);}
});
for(const target of ['s3-cpp','uno','nano'] as UrsTarget[])for(const p of levelProfiles)test(`24N ${target} ${p.id}: compile reference, alternative and both independent wrong criteria`,{
  skip:selected(target)||!(target==='s3-cpp'?process.env.LAB_S3_COMPILER_TEST:process.env.LAB_GRADING_COMPILER_TEST),timeout:600000},async()=>{
  for(const alternative of [false,true]){
    const project=alternative?alternateLevel(await starter(p.taskKey,target),p.taskKey.split('/')[1]):await starter(p.taskKey,target);
    if(!alternative)project.files['main.ino']+='\n// independent 24N reference\n';
    const r=await run(project,p,compilerOptions());assert.equal(r.status,'evaluated',JSON.stringify(r));assert.equal(r.points,10,JSON.stringify(r));assert.equal(r.provenance.method,'isolated-source-compilation');
  }
  for(const advanced of [false,true]){
    const r=await run(wrongLevel(await starter(p.taskKey,target),p.taskKey.split('/')[1],advanced),p,compilerOptions());
    assert.equal(r.status,'evaluated',JSON.stringify(r));assert.equal(r.points,advanced?8:3,JSON.stringify(r));assert.equal(r.provenance.method,'isolated-source-compilation');
  }
});
