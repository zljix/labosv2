import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import registry from '../school/grader/profiles.json';
import {gradeJob,digest} from '../school/grader/official';
import {gradingCoverage} from '../school/grader/coverage';
import {starter,solution,jobFor} from './school-contract-fixture';
import {introductoryProject} from './school-introductory-fixture';

const target=process.env.LAB_MATRIX_TARGET,workers=Number(process.env.LAB_MATRIX_WORKERS??4);
assert(!target||['micropython','s3-cpp','uno','nano'].includes(target),'Unknown matrix target');
assert(Number.isInteger(workers)&&workers>=1&&workers<=4,'Invalid matrix worker count');

test('24P current executable matrix: 268 URS combinations and five introductory expected outcomes',{timeout:1200000},async()=>{
  const coverage=gradingCoverage('24P'),results:any[]=[],allRows=[...coverage.rows,...coverage.introductory];
  const task=process.env.LAB_MATRIX_TASK,rows=allRows.filter(r=>(!task||r.taskKey===task)&&(!target||r.target===target));
  assert(rows.length>0,'The requested matrix partition is empty');
  let next=0;
  async function worker(){while(next<rows.length){
    const row=rows[next++],p=registry.profiles.find(p=>p.id===row.grading.profileId)!;
    // The three published C++ blink starters deliberately contain 500/500 ms.
    // Keep their exact trusted binaries and expect the published 8/10. A new
    // 250/750 source needs an isolated compiler; a changed source must never
    // borrow the starter's binary or be counted as executed without one.
    const cppBlink=p.kind==='blink'&&row.target!=='micropython',expectedPoints=cppBlink?8:10;
    const original=row.taskKey.startsWith('intro/')?introductoryProject(row.taskKey.split('/')[1]):await starter(row.taskKey,row.target as any);
    const project=cppBlink?original:solution(original,p);
    const job=jobFor(project,p),r=await gradeJob(job,{root:process.cwd()});
    results.push({taskKey:row.taskKey,target:row.target,profileId:p.id,snapshotHash:job.snapshotHash,contractHash:job.contractHash,seed:job.seed,
      expectedPoints,sourceCase:cppBlink?'published-500-500ms-cpp-starter':'reference-solution',status:r.status,points:r.points,checkerHash:r.checkerHash,durationMs:r.durationMs,virtualDurationMs:r.virtualDurationMs,peakRssKiB:r.peakRssKiB,...(r.points===expectedPoints?{}:{report:r})});
    console.log(`${results.length}/${rows.length} ${row.taskKey} ${row.target}: ${r.status} ${r.points} (expected ${expectedPoints})`);
  }}
  await Promise.all(Array.from({length:workers},worker));
  results.sort((a,b)=>(a.taskKey+'/'+a.target).localeCompare(b.taskKey+'/'+b.target));
  mkdirSync('docs/stage24p-evidence',{recursive:true});
  writeFileSync('docs/stage24p-evidence/'+(task?'current-matrix-recheck':target?'current-matrix-'+target:'current-matrix')+'.json',JSON.stringify({format:'labosv2-current-matrix',version:1,sourceCommit:process.env.GITHUB_SHA??null,workers,target:target??null,task:task??null,results},null,2)+'\n');
  assert.equal(results.length,rows.length);assert.equal(new Set(results.map(r=>r.checkerHash)).size,1);
  for(const r of results)assert.equal(r.points,r.expectedPoints,JSON.stringify(r));
});

test('24P legacy executable matrix: all 79 immutable published profiles still execute their original reference contract',{timeout:600000},async()=>{
  const profiles=registry.profiles.slice(0,79),results:any[]=[];let next=0;
  async function worker(){while(next<profiles.length){
    const p=profiles[next++];
    const project=p.taskKey.startsWith('intro/')?introductoryProject(p.taskKey.split('/')[1]):solution(await starter(p.taskKey),p);
    const projectJson=JSON.stringify(project);
    const job=p.contract?jobFor(project,p):{format:'labosv2-grading-job',version:1,checkerVersion:p.checkerVersion,profileId:p.id,target:'micropython',
      rubric:{profileId:p.id,criteria:p.criteria},seed:'5'.repeat(64),projectJson,snapshotHash:digest(projectJson),rubricHash:'2'.repeat(64)};
    const r=await gradeJob(job,{root:process.cwd()});
    results.push({profileId:p.id,snapshotHash:job.snapshotHash,status:r.status,points:r.points,checkerHash:r.checkerHash,...(r.points===10?{}:{report:r})});
    console.log(`legacy ${results.length}/79 ${p.id}: ${r.status} ${r.points}`);
  }}
  await Promise.all(Array.from({length:workers},worker));
  results.sort((a,b)=>a.profileId.localeCompare(b.profileId));
  mkdirSync('docs/stage24p-evidence',{recursive:true});
  writeFileSync('docs/stage24p-evidence/legacy-matrix.json',JSON.stringify({format:'labosv2-legacy-matrix',version:1,sourceCommit:process.env.GITHUB_SHA??null,results},null,2)+'\n');
  assert.equal(results.length,79);for(const r of results)assert.equal(r.points,10,JSON.stringify(r));
});
