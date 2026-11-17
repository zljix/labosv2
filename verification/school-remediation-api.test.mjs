import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {schoolFixture} from './school-http-fixture.mjs';
import {gradeJob} from '../school/grader/official.ts';
import {introductoryProject} from './school-introductory-fixture.ts';
import {readWork} from '../src/lessons/catalog.ts';
import {readUrsWork} from '../src/lessons/ursWork.ts';

test('24P PHP/MySQL preserves long Unicode identities, seeded version bindings, rework and both radio nodes',{timeout:240000},async t=>{
 const f=await schoolFixture(t),results=[];
 const ok=async(p,status=200)=>{const r=await p;assert.equal(r.status,status,r.text);return r.json;};
 const teacher=await f.make('remediation.teacher','teacher');
 let cls;
 for(const char of ['Ž','😀']){
  for(const length of [100,101,120,121])await ok(f.admin.call('create-user',{username:'length.'+char.codePointAt(0)+'.'+length,role:'student',displayName:char.repeat(length),temporaryPassword:f.temporary}),length<=120?201:422);
  for(const length of [40,41,80,81]){
   const created=await ok(teacher.client.call('create-class',{name:char.repeat(length),schoolYear:'2026/2027'}),length<=80?201:422);
   if(char==='Ž'&&length===80)cls=created.class;
  }
 }
 const student=await f.make('remediation.student','student','😀'.repeat(120));
 assert(cls,'The successful 80-character class must be reused rather than created twice.');
 const csv='username;displayName\n'+student.user.username+';'+student.user.displayName;
 const preview=await ok(teacher.client.call('preview-students',{classId:cls.id,csv}));await ok(teacher.client.call('import-students',{classId:cls.id,csv,previewToken:preview.previewToken,linkExisting:true}));
 const publish=async(key,id)=>(await ok(teacher.client.call('publish-task',{taskKey:key,gradingProfile:id}),201)).task;
 async function begin(task){const assignment=(await ok(teacher.client.call('create-assignment',{classId:cls.id,taskVersionId:task.id,target:'micropython'}),201)).assignment;return ok(student.client.call('begin-attempt',{assignmentId:assignment.id}));}
 async function evaluate(){const c=f.gradingCommand('claim');assert.equal(c.status,0,c.stderr);const {job}=JSON.parse(c.stdout);assert(job);const report=await gradeJob(job,{root:process.cwd()});const done=f.gradingCommand('complete',{jobId:job.jobId,lease:job.lease,report});assert.equal(done.status,0,done.stderr);return {job,report};}
 const task=await publish('intro/button','24P-v2-button@2'),opened=await begin(task);const initial=await evaluate();assert.equal(initial.report.points,3);
 assert.equal(readWork(opened.snapshot.project).student,student.user.displayName);assert.equal(readWork(opened.snapshot.project).group,cls.name);
 const solution=introductoryProject('button'),project=structuredClone(opened.snapshot.project);project.circuit=solution.circuit;project.files['main.py']=solution.files['main.py'];
 const saved=await ok(student.client.call('save-work',{attemptId:opened.attempt.id,expectedRevision:1,requestKey:randomUUID(),project}));assert.equal(saved.saved.revision,2);
 const {job,report}=await evaluate();assert.equal(report.points,10,JSON.stringify(report));assert.equal(job.profileId,'24P-v2-button@2');
 const locked=await ok(student.client.call('finish-attempt',{attemptId:opened.attempt.id,expectedRevision:2,requestKey:randomUUID()}));
 const rework=await ok(teacher.client.call('reopen-attempt',{attemptId:opened.attempt.id,submissionId:locked.submission.id,reason:'Demonstriraj i objasni promjenu.',requestKey:randomUUID()}));
 assert.equal(readWork(rework.snapshot.project).student,student.user.displayName);assert.equal(readWork(rework.snapshot.project).group,cls.name);await evaluate();
 const preserved=await ok(student.client.call('attempt&id='+opened.attempt.id));assert.equal(preserved.attempt.status,'locked');assert.equal(preserved.assignment.task.rubric.profileId,'24P-v2-button@2');assert.equal(preserved.snapshot.grading.points,10);
 // The normal pair has one joint worksheet at the root. This private test
 // starter also supplies a peer worksheet, to exercise identities wherever
 // a record exists without changing the published two-node teaching model.
 const radioPath=f.pkg+'/catalog/radio-radio-micropython.json',radioStarter=JSON.parse(readFileSync(radioPath,'utf8'));
 radioStarter.radio.peer.files['urs-vjezba.json']=radioStarter.files['urs-vjezba.json'];writeFileSync(radioPath,JSON.stringify(radioStarter));
 const radio=await begin(await publish('radio/radio','24M-radio@1'));
 for(const p of [radio.snapshot.project,radio.snapshot.project.radio.peer]){const w=readUrsWork(p);assert(w);assert.equal(w.student,student.user.displayName);assert.equal(w.group,cls.name);}
 results.push({profileId:job.profileId,snapshotHash:job.snapshotHash,report,locked:true,revision:2,studentCodePoints:Array.from(student.user.displayName).length,classCodePoints:Array.from(cls.name).length,radioNodesChecked:2,radioFixture:'explicit-peer-worksheet'});
 mkdirSync('docs/stage24p-evidence',{recursive:true});writeFileSync('docs/stage24p-evidence/mysql-remediation.json',JSON.stringify({format:'labosv2-remediation-api',version:1,sourceCommit:process.env.GITHUB_SHA??null,results},null,2)+'\n');
});
