import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {schoolFixture} from './school-http-fixture.mjs';

test('23H PHP/MySQL: scoped achievements, immutable reviews, selection, archive, retention and verified restore',{timeout:240000},async t=>{
  const f=await schoolFixture(t),teacher=await f.make('report.teacher','teacher'),other=await f.make('report.other','teacher'),a=await f.make('report.a','student','=Učenik A'),b=await f.make('report.b');
  const ok=async(p,status=200)=>{const r=await p;assert.equal(r.status,status,r.text);return r.json;};
  const c=(await ok(teacher.client.call('create-class',{name:'4.f izvještaji',schoolYear:'2026/2027'}),201)).class;
  const csv='username;displayName\n'+[a,b].map(p=>p.user.username+';'+p.user.displayName).join('\n');
  const plan=await ok(teacher.client.call('preview-students',{classId:c.id,csv}));await ok(teacher.client.call('import-students',{classId:c.id,csv,previewToken:plan.previewToken,linkExisting:true}));
  const task=(await ok(teacher.client.call('publish-task',{taskKey:'gpio/button',gradingProfile:'23E-button-led@1'}),201)).task;
  const ass=(await ok(teacher.client.call('create-assignment',{classId:c.id,taskVersionId:task.id,target:'micropython'}),201)).assignment;
  let opened=await ok(a.client.call('begin-attempt',{assignmentId:ass.id})),old,second,reviewId;const resourceWorks=[];
  const report=()=>ok(teacher.client.call('achievements&classId='+c.id));
  const grade=()=>{const claim=f.gradingCommand('claim');assert.equal(claim.status,0,claim.stderr);const job=JSON.parse(claim.stdout).job;assert(job);
    const result={checkerVersion:job.checkerVersion,profileId:job.profileId,snapshotHash:job.snapshotHash,rubricHash:job.rubricHash,checkerHash:'a'.repeat(64),status:'evaluated',points:10,maxPoints:10,criteria:job.rubric.criteria.map(x=>({...x,points:x.maxPoints,explanation:'Privatna testna isporuka'}))};
    const done=f.gradingCommand('complete',{jobId:job.jobId,lease:job.lease,report:result});assert.equal(done.status,0,done.stderr);};
  await t.test('unstarted work is included and no open attempt invents assessed zero; scope is enforced',async()=>{
    const r=await report();assert.equal(r.rows.length,2);assert(r.rows.every(r=>r.assessment.points===null));assert.equal(r.rows.find(r=>r.student.id===b.user.id).status,'not_started');
    for(const client of [a.client,other.client]){await ok(client.call('achievements&classId='+c.id),403);await ok(client.call('export-achievements&classId='+c.id),403);}
    await ok(teacher.client.call('achievements&classId='+c.id+'&studentId='+a.user.id));
    grade();const r2=await report();assert.equal(r2.rows[0].assessment.points,null,'An open graded attempt is not a locked assessment.');
    old=await ok(a.client.call('finish-attempt',{attemptId:opened.attempt.id,expectedRevision:1,requestKey:randomUUID()}));
    assert.equal((await report()).rows[0].assessment.points,10);
  });
  await t.test('teacher comments and corrections preserve automatic report; null, zero and decimal are distinct',async()=>{
    const body={attemptId:old.attempt.id,revision:1,action:'correct',points:0,reason:'Dokumentirana korekcija <img src=x>.',expectedReviewId:0,requestKey:randomUUID()};
    for(const client of [a.client,other.client])await ok(client.call('review-work',body),403);
    await ok(teacher.client.call('review-work',{...body,reason:''}),422);await ok(teacher.client.call('review-work',{...body,points:11}),422);await ok(teacher.client.call('review-work',{...body,points:'0'}),422);
    const first=await ok(teacher.client.call('review-work',body));reviewId=first.latestReviewId;
    assert.equal(first.reviews[0].author.id,teacher.user.id);assert.equal(first.reviews[0].points,0);
    assert.equal((await ok(teacher.client.call('review-work',body))).latestReviewId,reviewId);
    await ok(teacher.client.call('review-work',{...body,points:1}),409);
    let r=(await report()).rows[0];assert.equal(r.assessment.points,0);assert.equal(r.assessment.grading.points,10);assert.equal(r.assessment.source,'teacher');
    const changed=await ok(teacher.client.call('review-work',{...body,points:9.25,expectedReviewId:reviewId,requestKey:randomUUID()}));reviewId=changed.latestReviewId;
    await ok(teacher.client.call('review-work',{...body,points:5,requestKey:randomUUID()}),409);
    const comment=await ok(teacher.client.call('review-work',{...body,action:'comment',points:null,reason:'Razmisli o otpuštanju tipkala.',expectedReviewId:reviewId,requestKey:randomUUID()}));reviewId=comment.latestReviewId;
    r=(await report()).rows[0];assert.equal(r.assessment.points,9.25);assert.equal(r.assessment.grading.report.points,10);
    assert.equal((await ok(a.client.call('work-feedback&id='+old.attempt.id+'&revision=1'))).reviews.length,3);
    await ok(b.client.call('work-feedback&id='+old.attempt.id+'&revision=1'),403);
    const restore=await ok(teacher.client.call('review-work',{...body,action:'restore',points:null,reason:'Vraćam potvrđeni rezultat.',expectedReviewId:reviewId,requestKey:randomUUID()}));reviewId=restore.latestReviewId;
    assert.equal((await report()).rows[0].assessment.points,10);
  });
  await t.test('new attempts keep their own grades; explicit older submission selection is recorded and scoped',async()=>{
    second=await ok(teacher.client.call('reopen-attempt',{attemptId:old.attempt.id,submissionId:old.submission.id,reason:'Doradi rubni slučaj.',requestKey:randomUUID()}));
    assert.equal((await ok(a.client.call('grading&id='+second.attempt.id))).grading.teacherReview,undefined);
    let r=(await report()).rows[0];assert.equal(r.status,'reopened');assert.equal(r.submission.id,old.submission.id);assert.equal(r.assessment.points,10);
    second=await ok(a.client.call('finish-attempt',{attemptId:second.attempt.id,expectedRevision:1,requestKey:randomUUID()}));
    assert.equal((await report()).rows[0].assessment.points,null);
    await ok(teacher.client.call('review-work',{attemptId:second.attempt.id,revision:1,action:'correct',points:2.5,reason:'Ručni pregled dok provjera čeka.',expectedReviewId:0,requestKey:randomUUID()}));
    grade();const late=await ok(a.client.call('grading&id='+second.attempt.id));assert.equal(late.grading.points,10);assert.equal(late.grading.teacherReview.points,2.5);
    assert.equal((await report()).rows[0].assessment.points,2.5,'A delayed checker must retain the correction.');
    const choose={assignmentId:ass.id,studentId:a.user.id,submissionId:old.submission.id,reason:'Evidentiram prethodnu cjelovitu predaju.',requestKey:randomUUID()};
    await ok(a.client.call('select-assessment',choose),403);await ok(other.client.call('select-assessment',choose),403);
    await ok(teacher.client.call('select-assessment',{...choose,studentId:b.user.id}),422);
    await ok(teacher.client.call('select-assessment',choose));await ok(teacher.client.call('select-assessment',choose));
    r=(await report()).rows[0];assert.equal(r.submission.id,old.submission.id);assert.equal(r.assessment.points,10);assert.equal(r.selection.reason,choose.reason);
    const full=await ok(teacher.client.call('export-achievements&classId='+c.id+'&studentId='+a.user.id));assert.equal(full.rows.length,1);assert.equal(full.rows[0].assessment.points,10);
  });
  await t.test('paged reports and whole-selection export have exactly the same scoped pairs',async()=>{
    for(let n=0;n<51;n++)f.sql('INSERT INTO class_assignments (class_id,task_version_id,target,created_by) VALUES (?,?,?,?)',[c.id,task.id,'micropython',teacher.user.id]);
    const first=await report();assert.equal(first.rows.length,100);assert.equal(first.hasMore,true);
    const next=await ok(teacher.client.call('achievements&classId='+c.id+'&afterAssignment='+first.next.afterAssignment+'&afterStudent='+first.next.afterStudent));
    assert.equal(next.rows.length,4);assert.equal(next.hasMore,false);
    const all=await ok(teacher.client.call('export-achievements&classId='+c.id));assert.equal(all.rows.length,104);
    const keys=rows=>rows.map(r=>r.assignment.id+':'+r.student.id);assert.deepEqual(keys(all.rows),keys([...first.rows,...next.rows]));assert.equal(new Set(keys(all.rows)).size,104);
  });
  await t.test('backups include initial SD media, sources and both radio nodes as immutable snapshots',async()=>{
    for(const taskKey of ['storage/sdFiles','radio/radio']) {
      const v=(await ok(teacher.client.call('publish-task',{taskKey}),201)).task;
      const assignment=(await ok(teacher.client.call('create-assignment',{classId:c.id,taskVersionId:v.id,target:'micropython'}),201)).assignment;
      const w=await ok(b.client.call('begin-attempt',{assignmentId:assignment.id}));
      if(taskKey==='radio/radio')assert(w.snapshot.project.radio.peer.files['main.py']);
      const closed=await ok(b.client.call('finish-attempt',{attemptId:w.attempt.id,expectedRevision:1,requestKey:randomUUID()}));resourceWorks.push(closed);
    }
  });
  let pruneAttempt;
  await t.test('retention keeps initial/latest, all locked snapshots and reviews, with dry-run default',async()=>{
    const manual=(await ok(teacher.client.call('publish-task',{taskKey:'gpio/blink'}),201)).task;
    const assignment=(await ok(teacher.client.call('create-assignment',{classId:c.id,taskVersionId:manual.id,target:'micropython'}),201)).assignment;
    pruneAttempt=await ok(b.client.call('begin-attempt',{assignmentId:assignment.id}));
    for(let n=1;n<6;n++){const project=structuredClone(pruneAttempt.snapshot.project);project.files['main.py']+='\n# Revizija '+n;await ok(b.client.call('save-work',{attemptId:pruneAttempt.attempt.id,expectedRevision:n,requestKey:randomUUID(),project}));}
    f.sql("UPDATE work_snapshots SET created_at='2020-01-01' WHERE attempt_id=?",[pruneAttempt.attempt.id]);
    f.config.retention={revision_days:1,keep_latest:2};writeFileSync(join(f.root,'private.json'),JSON.stringify(f.config));
    const archive={schoolYear:c.schoolYear,archived:true,reason:'Zaključena školska evidencija.'};
    await ok(teacher.client.call('archive-year',archive),403);await ok(f.admin.call('archive-year',archive));
    await ok(b.client.call('save-work',{attemptId:pruneAttempt.attempt.id,expectedRevision:6,requestKey:randomUUID(),project:pruneAttempt.snapshot.project}),409);
    await ok(teacher.client.call('create-class',{name:'Arhivirana nova',schoolYear:c.schoolYear}),409);
    await ok(teacher.client.call('review-work',{attemptId:old.attempt.id,revision:1,action:'comment',points:null,reason:'Nije dopušteno.',expectedReviewId:reviewId,requestKey:randomUUID()}),409);
    assert.equal((await report()).class.archived,true);
    const dry=f.command('prune-revisions');assert.equal(dry.status,0,dry.stderr);assert.equal(JSON.parse(dry.stdout).snapshots,3);assert.equal(JSON.parse(dry.stdout).applied,false);
    const apply=f.command('prune-revisions',undefined,['--apply']);assert.equal(apply.status,0,apply.stderr);
    assert.deepEqual(f.sql('SELECT revision FROM work_snapshots WHERE attempt_id=? ORDER BY revision',[pruneAttempt.attempt.id]).map(r=>r.revision),[1,5,6]);
    assert.equal((await ok(a.client.call('attempt&id='+old.attempt.id))).snapshot.contentHash,old.snapshot.contentHash);
  });
  await t.test('private consistent backup restores accounts, both snapshots, original grades, decisions and hashes; corruption rolls back',async()=>{
    const restoreDsn=process.env.LAB_TEST_RESTORE_DSN;assert.match(restoreDsn??'',/^mysql:host=[^;]+;port=\d+;dbname=labosv2_test_[a-z0-9_]+;charset=utf8mb4$/);
    const path=join(f.root,'school-backup.jsonl'),backup=f.command('backup',undefined,[path]);assert.equal(backup.status,0,backup.stderr);
    assert.equal(f.command('backup',undefined,[path]).status,2,'Do not replace an existing backup.');
    assert.equal(f.command('backup',undefined,[join(f.pkg,'web','private.jsonl')]).status,2);
    const expected=f.sql('SELECT id,attempt_id,revision,snapshot_hash FROM school_submissions ORDER BY id');
    const target={...f.config,database:{...f.config.database,dsn:restoreDsn},app:{...f.config.app,session_directory:join(f.root,'restore-sessions')}};
    mkdirSync(target.app.session_directory,{mode:0o700});const targetJson=join(f.root,'restore.json'),targetConfig=join(f.root,'restore.php');
    writeFileSync(targetJson,JSON.stringify(target),{mode:0o600});writeFileSync(targetConfig,'<?php return json_decode(file_get_contents(__DIR__."/restore.json"),true,32,JSON_THROW_ON_ERROR);');
    const run=(action,p)=>spawnSync(process.env.PHP_BIN||'php',[join(f.pkg,'tools/console.php'),action,targetConfig,...(p?[p]:[])],{env:f.env,encoding:'utf8'});
    assert.equal(run('migrate').status,0);const bad=path+'.bad';writeFileSync(bad,readFileSync(path,'utf8').replace('=Učenik A','=Drugi učenik A'));
    const corrupt=run('restore',bad);assert.equal(corrupt.status,2,corrupt.stdout);
    const restore=run('restore',path);assert.equal(restore.status,0,restore.stderr);assert.equal(JSON.parse(restore.stdout).restored,true);
    assert.equal(run('restore',path).status,2,'Never restore over existing data.');
    writeFileSync(join(f.root,'private.json'),JSON.stringify(target));
    assert.deepEqual(f.sql('SELECT id,attempt_id,revision,snapshot_hash FROM school_submissions ORDER BY id'),expected);
    const restored=f.client();await ok(restored.login(a.user.username,f.password));const read=await ok(restored.call('attempt&id='+old.attempt.id));assert.equal(read.snapshot.contentHash,old.snapshot.contentHash);assert.equal(read.submission.grading.points,10);assert.deepEqual(read.snapshot.project,old.snapshot.project);
    const restoredTeacher=f.client();await ok(restoredTeacher.login(teacher.user.username,f.password));assert.equal((await ok(restoredTeacher.call('achievements&classId='+c.id))).rows[0].assessment.points,10);
    for(const original of resourceWorks){const copy=await ok(restoredTeacher.call('attempt&id='+original.attempt.id));assert.deepEqual(copy.snapshot.project,original.snapshot.project);assert.equal(copy.snapshot.contentHash,original.snapshot.contentHash);}
    assert.equal((await ok(restored.call('work-feedback&id='+old.attempt.id+'&revision=1'))).reviews.length,4);
    await ok(a.client.call('attempt&id='+old.attempt.id),401,'An old session cookie has no file in the new session directory.');
  });
});
