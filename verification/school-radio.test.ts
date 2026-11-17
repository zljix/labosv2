import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {gradeJob} from '../school/grader/official';
import {gradingCoverage} from '../school/grader/coverage';
import {radioStarter,radioProfile,jobFor,compilerOptions,alternateRadio,wrongRadio} from './school-radio-fixture';
import {createUrsProject,type UrsTarget} from '../src/lessons/ursCatalog';
const targets=['micropython','s3-cpp','uno','nano'] as UrsTarget[],results:any[]=[],root=process.cwd();
const skip=(t:string)=>!!process.env.LAB_RADIO_TARGET&&process.env.LAB_RADIO_TARGET!==t;
async function run(project:any,options:any={root},seed='5'.repeat(64)){
 const job=jobFor(project,radioProfile,seed),r=await gradeJob(job,options);results.push({target:job.target,profileId:radioProfile.id,snapshotHash:job.snapshotHash,contractHash:job.contractHash,seed,result:r});return r;
}
test.after(()=>{mkdirSync('docs/stage24m-evidence',{recursive:true});writeFileSync('docs/stage24m-evidence/radio-'+(process.env.LAB_RADIO_TARGET??'all')+'.json',JSON.stringify({format:'labosv2-radio-evidence',version:1,sourceCommit:process.env.GITHUB_SHA??null,results},null,2)+'\n');});
test('24M preserves all 69 old profiles and counts four main targets once',()=>{
 const r=JSON.parse(readFileSync('school/grader/profiles.json','utf8'));assert.deepEqual(r.profiles.slice(0,69),JSON.parse(readFileSync('verification/fixtures/24l-grading-profiles.json','utf8')).profiles);
 assert(gradingCoverage('test').summary.supported>=252);assert.deepEqual(radioProfile.criteria.map(c=>c.maxPoints),[3,5,2]);
});
for(const t of targets)test('24M '+t+': three repetitions, two broken paths and repair with another seed',{skip:skip(t),timeout:600000},async()=>{
 for(let i=0;i<3;i++){const p=await radioStarter(t),before=JSON.stringify(p),r=await run(p);assert.equal(r.status,'evaluated',JSON.stringify(r));assert.equal(r.points,10,JSON.stringify(r));assert.equal(JSON.stringify(p),before);}
 for(const [peer,pin]of [[false,'MISO'],[true,'MOSI']] as const){const p=await radioStarter(t),c=peer?p.radio!.peer.circuit:p.circuit;if(c.kind!=='editable')throw Error('editable');
  c.wires=c.wires.filter(w=>![w.from,w.to].some(e=>e.pin===pin));const r=await run(p);assert.equal(r.points,0,JSON.stringify(r));}
 const r=await run(await radioStarter(t),{root},'0'.repeat(64));assert.equal(r.points,10,JSON.stringify(r));
});
test('24M all sixteen mixed saved pairs execute both real programs',{skip:skip('micropython'),timeout:600000},async()=>{
 for(const a of targets)for(const b of targets){const r=await run(await radioStarter(a,b));assert.equal(r.status,'evaluated',JSON.stringify(r));assert.equal(r.points,10,JSON.stringify(r));assert.equal(Object.keys(r.provenance.nodes).length,2);}
});
test('24M alternative algorithms and layouts pass, independently wrong basic and advanced criteria score 3 and 8',{skip:skip('micropython'),timeout:180000},async()=>{
 assert.equal((await run(alternateRadio(await radioStarter()))).points,10);
 for(const advanced of [false,true]){const r=await run(wrongRadio(await radioStarter(),advanced));assert.equal(r.status,'evaluated',JSON.stringify(r));assert.equal(r.points,advanced?8:3,JSON.stringify(r));}
});
test('24M forged peer output, partial RX data and JavaScript access cannot fabricate reception',{skip:skip('micropython'),timeout:180000},async()=>{
 const fake=await radioStarter();fake.radio!.peer.files['main.py']='from time import sleep_ms\nfor n in range(1,11):\n print("RX",n)\n sleep_ms(100)\n';assert.equal((await run(fake)).points,0);
 const partial=await radioStarter();partial.radio!.peer.files['lab_nrf24.py']=partial.radio!.peer.files['lab_nrf24.py'].replace('self.command(0x61, read=8)','self.command(0x61, read=1)');const p=await run(partial);assert.equal(p.points,3,JSON.stringify(p));
 const attack=await radioStarter();attack.files['main.py']='import js\njs.eval("process.exit(0)")\n';const a=await run(attack);assert.equal(a.points,0);assert.equal(a.status,'program_error');
});
test('24M binding includes the peer and ignores stale peer binaries',{skip:skip('micropython'),timeout:60000},async()=>{
 const p=await radioStarter(),j=jobFor(p,radioProfile);p.radio!.peer.files['main.py']+='\n# changed peer\n';
 const r=await gradeJob({...j,projectJson:JSON.stringify(p)},{root});assert.equal(r.points,null);assert.equal(r.status,'unsupported');
 const stale=await radioStarter('micropython','uno');stale.radio!.peer.files['main.ino']+='\n// changed peer\n';const s=await run(stale);assert.equal(s.points,null);assert.equal(s.status,'unsupported');
});
for(const t of targets.filter(t=>t!=='micropython'))test('24M '+t+': independently compile both nodes for reference, alternative and both wrong criteria',{
 skip:skip(t)||!(t==='s3-cpp'?process.env.LAB_S3_COMPILER_TEST:process.env.LAB_GRADING_COMPILER_TEST),timeout:600000},async()=>{
 for(const kind of ['reference','alternative','basic','advanced']){
  let p=await radioStarter(t);if(kind==='alternative')p=alternateRadio(p);if(kind==='basic'||kind==='advanced')p=wrongRadio(p,kind==='advanced');
  if(kind==='reference'){p.files['main.ino']+='\n// independent 24M A\n';p.radio!.peer.files['main.ino']+='\n// independent 24M B\n';}
  const r=await run(p,compilerOptions());assert.equal(r.status,'evaluated',JSON.stringify(r));assert.equal(r.points,kind==='basic'?3:kind==='advanced'?8:10,JSON.stringify(r));
  assert(Object.values(r.provenance.nodes).every((n:any)=>n.method==='isolated-source-compilation'));
 }
});

test('24M non-yielding Python is stopped with no awarded zero',{skip:skip('micropython'),timeout:15000},async()=>{
 const p=await radioStarter();p.files['main.py']='while True:\n pass\n';const r=await run(p,{root,timeoutMs:1500});assert.equal(r.status,'execution_limit');assert.equal(r.points,null);
});
