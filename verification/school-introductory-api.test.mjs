import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import {schoolFixture} from './school-http-fixture.mjs';
import {gradeJob} from '../school/grader/official.ts';
import {introductoryProject} from './school-introductory-fixture.ts';
import {contractDigest} from '../school/grader/contract.ts';

test('24O PHP/MySQL gives five independent introductory attempts, genuine grades, revision history and locked submissions',{timeout:240000},async t=>{
  const f=await schoolFixture(t),teacher=await f.make('intro.teacher','teacher'),student=await f.make('intro.student'),results=[];
  const ok=async(p,status=200)=>{const r=await p;assert.equal(r.status,status,r.text);return r.json;};
  const cls=(await ok(teacher.client.call('create-class',{name:'3.f Uvodne vježbe',schoolYear:'2026/2027'}),201)).class;
  const csv='username;displayName\n'+student.user.username+';'+student.user.displayName;
  const preview=await ok(teacher.client.call('preview-students',{classId:cls.id,csv}));await ok(teacher.client.call('import-students',{classId:cls.id,csv,previewToken:preview.previewToken,linkExisting:true}));
  const catalog=(await ok(teacher.client.call('catalog'))).catalog,profiles=catalog.gradingProfiles.filter(p=>p.id.startsWith('24O-'));
  assert.equal(profiles.length,5);assert.equal(catalog.entries.filter(e=>e.set==='urs').length,67);assert.equal(catalog.gradingSummary.supported,268);
  assert.deepEqual(catalog.introductorySummary,{total:5,supported:5,unsupported:0});
  const publish=async(key,id)=>(await ok(teacher.client.call('publish-task',{taskKey:key,gradingProfile:id}),201)).task;
  const privateCall=(action,body)=>{const r=f.gradingCommand(action,body);assert.equal(r.status,0,r.stderr);return JSON.parse(r.stdout);};
  async function evaluate(expected){const job=privateCall('claim').job;assert(job);const report=await gradeJob(job,{root:process.cwd()});assert.equal(report.points,expected,JSON.stringify(report));privateCall('complete',{jobId:job.jobId,lease:job.lease,report});return {job,report};}
  async function begin(task,target='micropython'){
    const a=(await ok(teacher.client.call('create-assignment',{classId:cls.id,taskVersionId:task.id,target}),201)).assignment;
    return ok(student.client.call('begin-attempt',{assignmentId:a.id}));
  }
  const legacy=await publish('gpio/button','24B-button-led@1'),old=await begin(legacy),oldResult=await evaluate(10);
  await ok(student.client.call('finish-attempt',{attemptId:old.attempt.id,expectedRevision:1,requestKey:randomUUID()}));
  for(const [index,profile] of profiles.entries()){
    const task=await publish(profile.taskKey,profile.id);assert.equal(task.rubric.checkerVersion,'24O.1');assert.equal(task.definition.set,'introductory');assert.deepEqual(task.definition.targets,['micropython']);
    await ok(teacher.client.call('create-assignment',{classId:cls.id,taskVersionId:task.id,target:'uno'}),422);
    await ok(teacher.client.call('publish-task',{taskKey:profile.taskKey,gradingProfile:'24I-regulator@1'}),422);
    const opened=await begin(task),initial=await evaluate([0,3,3,8,3][index]),initialProject=opened.snapshot.project;
    const work=JSON.parse(initialProject.files['vjezba.json']);assert.equal(work.student,student.user.displayName);assert.equal(work.group,cls.name);assert.equal(initialProject.files['urs-vjezba.json'],undefined);
    assert.equal(initial.job.version,2);assert.equal(initial.job.contractHash,contractDigest(task.rubric.contract));
    const solution=introductoryProject(profile.taskKey.split('/')[1]);
    const project={...initialProject,circuit:solution.circuit,files:{...initialProject.files,...solution.files,'provjera.json':'{"points":999,"authority":"server-verified"}'}};
    const solvedWork=JSON.parse(project.files['vjezba.json']);solvedWork.student=student.user.displayName;solvedWork.group=cls.name;solvedWork.answers[0]='Moje opažanje';project.files['vjezba.json']=JSON.stringify(solvedWork);
    const payload={attemptId:opened.attempt.id,expectedRevision:1,requestKey:randomUUID(),project};
    const saved=await ok(student.client.call('save-work',payload));assert.equal(saved.saved.revision,2);
    const graded=await evaluate(10);assert.equal(graded.job.revision,2);assert.equal(graded.job.rubricDigest,contractDigest(task.rubric));
    await ok(student.client.call('finish-attempt',{attemptId:opened.attempt.id,expectedRevision:2,requestKey:randomUUID()}));
    const locked=await ok(student.client.call('attempt&id='+opened.attempt.id));assert.equal(locked.attempt.grading.points,10);assert.equal(locked.assignment.task.contentHash,task.contentHash);assert.equal(locked.attempt.status,'locked');
    await ok(student.client.call('save-work',{...payload,expectedRevision:2,requestKey:randomUUID()}),409);
    const revision=await ok(student.client.call('attempt&id='+opened.attempt.id+'&revision=1'));assert.equal(revision.snapshot.grading.points,initial.report.points);
    const teacherView=await ok(teacher.client.call('class-work&assignmentId='+opened.assignment.id));assert.equal(teacherView.rows[0].attempt.grading.points,10);
    results.push({profileId:profile.id,target:'micropython',taskHash:task.contentHash,attemptId:opened.attempt.id,initialReport:initial.report,report:graded.report,locked:true,revision:2});
  }
  assert.equal(new Set(results.map(r=>r.attemptId)).size,5);assert.equal(f.command('migrate').status,0);
  const preserved=await ok(student.client.call('attempt&id='+old.attempt.id));assert.equal(preserved.assignment.task.contentHash,legacy.contentHash);assert.equal(preserved.assignment.task.rubric.profileId,'24B-button-led@1');assert.equal(preserved.attempt.grading.points,oldResult.report.points);
  mkdirSync('docs/stage24o-evidence',{recursive:true});writeFileSync('docs/stage24o-evidence/mysql-introductory.json',JSON.stringify({format:'labosv2-introductory-api-evidence',version:1,sourceCommit:process.env.GITHUB_SHA??null,legacyPreserved:true,legacyResult:oldResult.report,results},null,2)+'\n');
});
