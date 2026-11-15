import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import {schoolFixture} from './school-http-fixture.mjs';
import {gradeJob} from '../school/grader/official.ts';
import {contractDigest} from '../school/grader/contract.ts';

test('24AB PHP/MySQL freezes new contracts, rejects cross-job replay and preserves legacy tasks',{timeout:180000},async t=>{
  const f=await schoolFixture(t),teacher=await f.make('contract.teacher','teacher'),student=await f.make('contract.student');
  const ok=async(p,status=200)=>{const r=await p;assert.equal(r.status,status,r.text);return r.json;};
  const cls=(await ok(teacher.client.call('create-class',{name:'4.f ugovori',schoolYear:'2026/2027'}),201)).class;
  const csv='username;displayName\n'+student.user.username+';'+student.user.displayName;
  const preview=await ok(teacher.client.call('preview-students',{classId:cls.id,csv}));
  await ok(teacher.client.call('import-students',{classId:cls.id,csv,previewToken:preview.previewToken,linkExisting:true}));
  const publish=async id=>(await ok(teacher.client.call('publish-task',{taskKey:'gpio/button',gradingProfile:id}),201)).task;
  const legacy=await publish('23E-button-led@1'),current=await publish('24B-button-led@1');
  assert.equal(legacy.rubric.contract,undefined);assert.equal(legacy.rubric.checkerVersion,'23E.1');
  assert.equal(current.rubric.contract.scenario.responseDeadlineMs,50);assert.equal(current.rubric.checkerVersion,'24AB.1');
  const privateCall=(action,body)=>{const r=f.gradingCommand(action,body);assert.equal(r.status,0,r.stderr+r.stdout);return JSON.parse(r.stdout);};
  const begin=async(task,target)=>{
    const a=(await ok(teacher.client.call('create-assignment',{classId:cls.id,taskVersionId:task.id,target}),201)).assignment;
    return ok(student.client.call('begin-attempt',{assignmentId:a.id}));
  };
  const old=await begin(legacy,'micropython'),oldJob=privateCall('claim').job;
  assert.equal(oldJob.version,1);const oldResult=await gradeJob(oldJob,{root:process.cwd()});assert.equal(oldResult.points,10);
  privateCall('complete',{jobId:oldJob.jobId,lease:oldJob.lease,report:oldResult});
  const opened=await begin(current,'s3-cpp'),job=privateCall('claim').job;
  assert.equal(job.version,2);assert.equal(job.taskKey,'gpio/button');
  assert.equal(job.rubricDigest,contractDigest(current.rubric));assert.equal(job.contractHash,contractDigest(current.rubric.contract));
  const r=await gradeJob(job,{root:process.cwd()});assert.equal(r.status,'evaluated',JSON.stringify(r));assert.equal(r.points,10,JSON.stringify(r));
  for(const change of [{jobId:job.jobId+1},{attemptId:job.attemptId+1},{revision:job.revision+1},{target:'uno'},{contractHash:'0'.repeat(64)},{rubricDigest:'0'.repeat(64)},{seedHash:'0'.repeat(64)},
    {criteria:r.criteria.map((c,i)=>i===0?{...c,passed:false}:c)},{criteria:r.criteria.map((c,i)=>i===0?{...c,description:'Izmijenjeno'}:c)}]){
    const bad=f.gradingCommand('complete',{jobId:job.jobId,lease:job.lease,report:{...r,...change}});
    assert.equal(bad.status,2,bad.stderr);assert.match(bad.stderr,/report_binding|criteria/);
  }
  privateCall('complete',{jobId:job.jobId,lease:job.lease,report:r});
  await ok(student.client.call('finish-attempt',{attemptId:opened.attempt.id,expectedRevision:1,requestKey:randomUUID()}));
  assert.equal((await ok(student.client.call('attempt&id='+opened.attempt.id))).attempt.grading.points,10);
  const another=await begin(current,'micropython'),otherJob=privateCall('claim').job;
  const replay=f.gradingCommand('complete',{jobId:otherJob.jobId,lease:otherJob.lease,report:{...r,target:'micropython',snapshotHash:otherJob.snapshotHash}});
  assert.equal(replay.status,2);
  const fresh=await gradeJob(otherJob,{root:process.cwd()});assert.equal(fresh.points,10);
  privateCall('complete',{jobId:otherJob.jobId,lease:otherJob.lease,report:fresh});
  await publish('24B-button-led@1');assert.equal(f.command('migrate').status,0);
  assert.equal((await ok(student.client.call('attempt&id='+old.attempt.id))).assignment.task.contentHash,legacy.contentHash);
  assert.equal((await ok(student.client.call('attempt&id='+opened.attempt.id))).assignment.task.contentHash,current.contentHash);
  assert.equal((await ok(student.client.call('attempt&id='+another.attempt.id))).attempt.grading.points,10);
  mkdirSync('docs/stage24ab-evidence',{recursive:true});
  writeFileSync('docs/stage24ab-evidence/mysql-contract.json',JSON.stringify({format:'labosv2-contract-api-evidence',version:1,
    sourceCommit:process.env.GITHUB_SHA??null,legacy:{profileId:oldJob.profileId,version:oldJob.version,result:oldResult},
    current:{profileId:job.profileId,version:job.version,jobId:job.jobId,target:job.target,snapshotHash:job.snapshotHash,
      rubricDigest:job.rubricDigest,contractHash:job.contractHash,result:r},
    rejectedBindings:9,crossJobReplayRejected:true,lockedSubmissionPreserved:true,legacyTaskPreserved:true},null,2)+'\n');
});
