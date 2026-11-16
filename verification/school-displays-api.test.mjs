import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import {schoolFixture} from './school-http-fixture.mjs';
import {gradeJob} from '../school/grader/official.ts';
import {contractDigest} from '../school/grader/contract.ts';

test('24H PHP/MySQL publishes all 32 display combinations, stores genuine scores, locks work and preserves the digital-threshold task',{timeout:600000},async t=>{
  const f=await schoolFixture(t),teacher=await f.make('displays.teacher','teacher'),student=await f.make('displays.student'),results=[];
  const ok=async(p,status=200)=>{const r=await p;assert.equal(r.status,status,r.text);return r.json;};
  const cls=(await ok(teacher.client.call('create-class',{name:'4.f prikaz i SPI',schoolYear:'2026/2027'}),201)).class;
  const csv='username;displayName\n'+student.user.username+';'+student.user.displayName;
  const preview=await ok(teacher.client.call('preview-students',{classId:cls.id,csv}));await ok(teacher.client.call('import-students',{classId:cls.id,csv,previewToken:preview.previewToken,linkExisting:true}));
  const catalog=(await ok(teacher.client.call('catalog'))).catalog,profiles=catalog.gradingProfiles.filter(p=>p.id.startsWith('24H-'));
  assert.equal(profiles.length,8);assert(catalog.gradingSummary.supported>=176);
  const publish=async(key,id)=>(await ok(teacher.client.call('publish-task',{taskKey:key,gradingProfile:id}),201)).task;
  const legacy=await publish('gpio/adc','24B-analog-threshold@1');
  const privateCall=(action,body)=>{const r=f.gradingCommand(action,body);assert.equal(r.status,0,r.stderr);return JSON.parse(r.stdout);};
  const begin=async(task,target='micropython')=>{
    const a=(await ok(teacher.client.call('create-assignment',{classId:cls.id,taskVersionId:task.id,target}),201)).assignment;
    return ok(student.client.call('begin-attempt',{assignmentId:a.id}));
  };
  const old=await begin(legacy),oldJob=privateCall('claim').job;
  // The untouched ADC/PWM starter deliberately does not solve the older
  // digital-threshold rubric. Keep its actual result with that older contract.
  const oldResult=await gradeJob(oldJob,{root:process.cwd()});assert.equal(oldResult.status,'evaluated');
  privateCall('complete',{jobId:oldJob.jobId,lease:oldJob.lease,report:oldResult});
  await ok(student.client.call('finish-attempt',{attemptId:old.attempt.id,expectedRevision:1,requestKey:randomUUID()}));
  for(const profile of profiles)for(const target of ['micropython','s3-cpp','uno','nano']){
    const task=await publish(profile.taskKey,profile.id);
    assert.equal(task.rubric.checkerVersion,'24H.1');assert.equal(task.rubric.contract.scenario.stageDurationMs>0,true);
    const opened=await begin(task,target);let revision=1,job=privateCall('claim').job;
    assert.equal(job.version,2);assert.equal(job.rubricDigest,contractDigest(task.rubric));assert.equal(job.contractHash,contractDigest(task.rubric.contract));
    const report=await gradeJob(job,{root:process.cwd()});assert.equal(report.points,10,JSON.stringify(report));
    const bad=f.gradingCommand('complete',{jobId:job.jobId,lease:job.lease,report:{...report,contractHash:oldJob.contractHash}});assert.equal(bad.status,2);
    privateCall('complete',{jobId:job.jobId,lease:job.lease,report});
    await ok(student.client.call('finish-attempt',{attemptId:opened.attempt.id,expectedRevision:revision,requestKey:randomUUID()}));
    const saved=await ok(student.client.call('attempt&id='+opened.attempt.id));assert.equal(saved.attempt.grading.points,10);assert.equal(saved.assignment.task.contentHash,task.contentHash);
    results.push({target,profileId:profile.id,taskHash:task.contentHash,jobId:job.jobId,report,locked:true});
  }
  assert.equal(f.command('migrate').status,0);
  const preserved=await ok(student.client.call('attempt&id='+old.attempt.id));assert.equal(preserved.assignment.task.contentHash,legacy.contentHash);assert.equal(preserved.attempt.grading.points,oldResult.points);
  assert.equal(preserved.assignment.task.rubric.profileId,'24B-analog-threshold@1');
  mkdirSync('docs/stage24h-evidence',{recursive:true});writeFileSync('docs/stage24h-evidence/mysql-displays.json',JSON.stringify({format:'labosv2-displays-api-evidence',version:1,sourceCommit:process.env.GITHUB_SHA??null,legacyPreserved:true,legacyResult:oldResult,results},null,2)+'\n');
});
