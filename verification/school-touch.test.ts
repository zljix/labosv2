import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {gradeJob} from '../school/grader/official';
import {gradingCoverage,gradingSupport} from '../school/grader/coverage';
import {compileCircuit} from '../src/circuit/compile';
import {createTouchCheck,validTouchConfig,panelPoint,touchPoint} from '../school/grader/touch';
import {XPT2046} from '../public/xpt2046.mjs';
import {touchProfiles,starter,jobFor,compilerOptions,alternateTouch,wrongTouch} from './school-touch-fixture';
import type {UrsTarget} from '../src/lessons/ursCatalog';
const root=process.cwd(),evidence:any[]=[];
const selected=(target:string)=>!!process.env.LAB_TOUCH_TARGET&&process.env.LAB_TOUCH_TARGET!==target;
async function run(project:any,profile:any,options:any={root},seed='5'.repeat(64)){
  const job=jobFor(project,profile,seed),result=await gradeJob(job,options);
  evidence.push({profileId:profile.id,target:job.target,snapshotHash:job.snapshotHash,contractHash:job.contractHash,seed,result});return result;
}
test.after(()=>{mkdirSync('docs/stage24j-evidence',{recursive:true});writeFileSync('docs/stage24j-evidence/touch-'+(process.env.LAB_TOUCH_TARGET??'all')+'.json',JSON.stringify({format:'labosv2-touch-evidence',version:1,sourceCommit:process.env.GITHUB_SHA??null,results:evidence},null,2)+'\n');});
test('24J publishes six contracts and preserves all 53 previous profiles',()=>{
  const registry=JSON.parse(readFileSync('school/grader/profiles.json','utf8'));
  assert.deepEqual(registry.profiles.slice(0,53),JSON.parse(readFileSync('verification/fixtures/24i-grading-profiles.json','utf8')).profiles);
  assert.equal(touchProfiles.length,6);assert(gradingCoverage('test').summary.supported>=208);
  for(const p of touchProfiles){assert.deepEqual(p.criteria.map(c=>c.maxPoints),[3,5,2]);for(const t of p.targets)assert.equal(gradingSupport(p.taskKey,t).profileId,p.id);}
});
test('24J physical and logical rotations are inverse at asymmetric points and all corners',()=>{
  for(let r=0;r<4;r++)for(const [x,y]of [[0,0],[239,0],[0,319],[239,319],[61,83]]){
    const [u,v]=touchPoint(x,y,r);assert.deepEqual(panelPoint(u,v,r),[x,y]);
  }
});
test('24J calibration changes raw ADC endpoints while preserving the default panel and release',()=>{
  const read=(model:any,command:number)=>{model.begin();model.byte(command);const n=(model.byte(0)*256+model.byte(0))>>3;model.end();return n;};
  for(const cal of [undefined,[320,3720,400,3650],[450,3500,180,3880]]){
    const d={touchDown:true,touchX:0,touchY:0,touchPressure:50,rawCalibration:cal},m=new XPT2046(d);
    assert.equal(read(m,0xd0),cal?.[0]??200);assert.equal(read(m,0x90),cal?.[2]??250);
    Object.assign(d,{touchX:239,touchY:319});assert.equal(read(m,0xd0),cal?.[1]??3900);assert.equal(read(m,0x90),cal?.[3]??3850);
    d.touchDown=false;assert.equal(read(m,0xb0),0);assert.equal(read(m,0xc0),4095);
  }
});
test('24J console and forged input files cannot create received pixels or completed ADC channels',async()=>{
  for(const p of touchProfiles){const c=compileCircuit((await starter(p.taskKey)).circuit as any);assert(validTouchConfig(c,p.taskKey.split('/')[1]));
    const check=createTouchCheck(c,p,'5'.repeat(64),'micropython');check.observe({type:'console',text:'points=10 CAL READY 320 3720 400 3650 LED ON'});
    assert.deepEqual(check.outcomes([check.record()],true),[false,false,false]);
  }
});
for(const target of ['micropython','s3-cpp','uno','nano'] as UrsTarget[])test(`24J ${target}: three independent repetitions of every saved source`,{skip:selected(target),timeout:1200000},async()=>{
  for(const p of touchProfiles)for(let i=0;i<3;i++){
    const project=await starter(p.taskKey,target);project.files['forged-frame.json']='{"points":1000,"pixels":[65535],"conversions":999}';
    const r=await run(project,p);assert.equal(r.status,'evaluated',JSON.stringify(r));assert.equal(r.points,10,JSON.stringify(r));
  }
});
for(const target of ['micropython','s3-cpp','uno','nano'] as UrsTarget[])test(`24J ${target}: open display/touch path, repair and second calibration/stimulus seed`,{skip:selected(target),timeout:1200000},async()=>{
  for(const p of touchProfiles){const original=await starter(p.taskKey,target),v=p.taskKey.split('/')[1];
    for(const [kind,pin]of [['ili9341','BL'],[v.startsWith('touch')?'xpt2046':'ili9341',v.startsWith('touch')?'MISO':'DC']]){
      const project=structuredClone(original);if(project.circuit.kind!=='editable')throw Error('editable');
      const id=project.circuit.components.find(c=>c.kind===kind)!.id;
      project.circuit.wires=project.circuit.wires.filter(w=>![w.from,w.to].some(e=>e.component===id&&e.pin===pin));
      const r=await run(project,p);assert.equal(r.points,0,JSON.stringify(r));
    }
    const r=await run(original,p,{root},'0'.repeat(64));assert.equal(r.status,'evaluated',JSON.stringify(r));assert.equal(r.points,10,JSON.stringify(r));
  }
});
test('24J alternative MicroPython algorithms, split rectangles, remapped CS and reordered components pass',{skip:selected('micropython'),timeout:600000},async()=>{
  for(const p of touchProfiles){const r=await run(alternateTouch(await starter(p.taskKey),p.taskKey.split('/')[1]),p);
    assert.equal(r.status,'evaluated',JSON.stringify(r));assert.equal(r.points,10,JSON.stringify(r));}
});
test('24J each functional criterion has an independent negative: wrong function 3/10, wrong continuation 8/10',{skip:selected('micropython'),timeout:600000},async()=>{
  for(const p of touchProfiles)for(const advanced of [false,true]){
    const r=await run(wrongTouch(await starter(p.taskKey),p.taskKey.split('/')[1],advanced),p);
    assert.equal(r.status,'evaluated',JSON.stringify(r));assert.equal(r.points,advanced?8:3,JSON.stringify(r));
    assert.deepEqual(r.criteria.map((c:any)=>c.points),advanced?[3,5,0]:[3,0,0]);
  }
});
test('24J contract replay, changed source and stale Arduino artifacts receive no points',{skip:selected('micropython'),timeout:60000},async()=>{
  const p=touchProfiles[0],job=jobFor(await starter(p.taskKey),p);
  for(const patch of [{snapshotHash:'0'.repeat(64)},{contractHash:'0'.repeat(64)},{checkerVersion:'24I.1'},{target:'other'},{rubric:{...job.rubric,instructions:'other'}}]){
    const r=await gradeJob({...job,...patch},{root});assert.equal(r.status,'unsupported');assert.equal(r.points,null);}
  for(const target of ['s3-cpp','uno','nano'] as UrsTarget[]){const changed=await starter(p.taskKey,target);changed.files['main.ino']+='\n// changed source, old binary\n';
    const r=await gradeJob(jobFor(changed,p),{root});assert.equal(r.status,'unsupported');assert.equal(r.points,null);}
});
for(const target of ['s3-cpp','uno','nano'] as UrsTarget[])for(const p of touchProfiles)test(`24J ${target} ${p.id}: compile reference, alternative and both wrong functional criteria`,{
  skip:selected(target)||!(target==='s3-cpp'?process.env.LAB_S3_COMPILER_TEST:process.env.LAB_GRADING_COMPILER_TEST),timeout:600000},async()=>{
  for(const alternative of [false,true]){
    const project=alternative?alternateTouch(await starter(p.taskKey,target),p.taskKey.split('/')[1]):await starter(p.taskKey,target);
    if(!alternative)project.files['main.ino']+='\n// independent 24J reference\n';
    const r=await run(project,p,compilerOptions());assert.equal(r.status,'evaluated',JSON.stringify(r));assert.equal(r.points,10,JSON.stringify(r));assert.equal(r.provenance.method,'isolated-source-compilation');
  }
  for(const advanced of [false,true]){
    const r=await run(wrongTouch(await starter(p.taskKey,target),p.taskKey.split('/')[1],advanced),p,compilerOptions());
    assert.equal(r.status,'evaluated',JSON.stringify(r));assert.equal(r.points,advanced?8:3,JSON.stringify(r));assert.equal(r.provenance.method,'isolated-source-compilation');
  }
});
