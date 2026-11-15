import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {schoolFixture} from './school-http-fixture.mjs';

test('23F real PHP/MySQL: immutable submissions, concurrent finish/save, delayed grades and linked rework',{timeout:180000},async t=>{
  const f=await schoolFixture(t),teacher=await f.make('finish.teacher','teacher'),outsider=await f.make('finish.other','teacher'),a=await f.make('finish.a'),b=await f.make('finish.b');
  async function ok(p,status=200){const r=await p;assert.equal(r.status,status,r.text);return r.json;}
  const c=(await ok(teacher.client.call('create-class',{name:'4.f predaje',schoolYear:'2026/2027'}),201)).class;
  const csv='username;displayName\n'+[a,b].map(p=>p.user.username+';'+p.user.displayName).join('\n');
  const plan=await ok(teacher.client.call('preview-students',{classId:c.id,csv}));await ok(teacher.client.call('import-students',{classId:c.id,csv,previewToken:plan.previewToken,linkExisting:true}));
  const task=(await ok(teacher.client.call('publish-task',{taskKey:'gpio/button',gradingProfile:'23E-button-led@1'}),201)).task;
  const assignment=(await ok(teacher.client.call('create-assignment',{classId:c.id,taskVersionId:task.id,target:'micropython'}),201)).assignment;
  const initial=await ok(a.client.call('begin-attempt',{assignmentId:assignment.id})),id=initial.attempt.id;
  const p=structuredClone(initial.snapshot.project);p.files['main.py']+='\n# Završna verzija';p.files['odgovori.json']='{"odgovor":"Sačuvaj me"}';
  const save={attemptId:id,expectedRevision:1,requestKey:randomUUID(),project:p};await ok(a.client.call('save-work',save));
  const body={attemptId:id,expectedRevision:2,requestKey:'a'.repeat(80),studentId:b.user.id,points:999};
  let sealed,claimed,rework;
  const privateGrade=(action,input)=>{const r=f.gradingCommand(action,input);assert.equal(r.status,0,r.stderr);return JSON.parse(r.stdout);};
  await t.test('stale revision, staff finalization, impersonation, methods and CSRF fail without sealing',async()=>{
    await ok(a.client.call('finish-attempt',{...body,expectedRevision:1}),409);
    for(const actor of [teacher,outsider,b])await ok(actor.client.call('finish-attempt',body),403);
    await ok(a.client.call('finish-attempt'),405);
    const anonymous=f.client();await ok(anonymous.call('finish-attempt',body),403);
    assert.equal(f.sql('SELECT COUNT(*) AS n FROM school_submissions')[0].n,0);
  });
  await t.test('two independent finish keys create one submission, including an 80-character key',async()=>{
    claimed=privateGrade('claim').job;assert.equal(claimed.attemptId,id);assert.equal(claimed.revision,2);
    const otherTab=f.client();await ok(otherTab.login('finish.a',f.password));
    const pair=await Promise.all([ok(a.client.call('finish-attempt',body)),ok(otherTab.call('finish-attempt',{...body,requestKey:randomUUID()}))]);
    sealed=pair[0];assert.equal(sealed.submission.id,pair[1].submission.id);assert.equal(sealed.attempt.status,'locked');
    assert.equal(sealed.submission.revision,2);assert.equal(sealed.submission.contentHash,sealed.snapshot.contentHash);assert.equal(sealed.submission.taskVersionId,task.id);
    assert.equal(sealed.student.id,a.user.id);assert.deepEqual(sealed.snapshot.project,p);assert.equal(sealed.submission.grading.points,null);assert.equal(sealed.submission.grading.status,'running');
    assert.equal(f.sql('SELECT COUNT(*) AS n FROM school_submissions WHERE attempt_id=?',[id])[0].n,1);
    assert.equal(f.sql("SELECT COUNT(*) AS n FROM audit_events WHERE event='attempt.submitted'")[0].n,1);
  });
  await t.test('lost finish response repeats safely; new saves and reused keys cannot replace sealed content',async()=>{
    const retry=await ok(a.client.call('finish-attempt',body));assert.deepEqual(retry.submission,sealed.submission);
    await ok(a.client.call('finish-attempt',{...body,expectedRevision:1}),409);
    const edited=structuredClone(p);edited.files['main.py']='print("too late")';
    const late=await a.client.call('save-work',{...save,expectedRevision:2,requestKey:randomUUID(),project:edited});assert.equal(late.status,409);assert.equal(late.json.error.code,'attempt_locked');
    await ok(a.client.call('save-work',save)); // An old acknowledgement is safe; no write occurs.
    await ok(a.client.call('save-work',{...save,project:edited}),409);
    const read=await ok(a.client.call('attempt&id='+id));assert.deepEqual(read.snapshot.project,p);assert.equal(read.snapshot.revision,2);
    assert.equal((await ok(a.client.call('begin-attempt',{assignmentId:assignment.id}))).attempt.id,id);
  });
  await t.test('only assigned staff can allow rework, with an explicit reason and immutable parent',async()=>{
    const reopen={attemptId:id,submissionId:sealed.submission.id,reason:'Ispravi ponašanje na otpuštanje <img src=x>.',requestKey:randomUUID()};
    await ok(a.client.call('reopen-attempt',reopen),403);await ok(outsider.client.call('reopen-attempt',reopen),403);
    await ok(teacher.client.call('reopen-attempt',{...reopen,reason:''}),422);await ok(teacher.client.call('reopen-attempt',{...reopen,submissionId:sealed.submission.id+100}),409);
    rework=await ok(teacher.client.call('reopen-attempt',reopen));assert.notEqual(rework.attempt.id,id);assert.equal(rework.attempt.number,2);assert.equal(rework.attempt.revision,1);assert.equal(rework.attempt.status,'in_progress');
    assert.equal(rework.reopening.submissionId,sealed.submission.id);assert.equal(rework.reopening.reason,reopen.reason);assert.equal(rework.reopening.openedBy,teacher.user.id);
    assert.equal(rework.snapshot.project.files['main.py'],p.files['main.py']);assert.deepEqual(rework.snapshot.project.circuit,p.circuit);assert.equal(rework.snapshot.project.files['odgovori.json'],p.files['odgovori.json']);
    assert.notEqual(rework.snapshot.project.id,p.id);assert.equal(rework.assignment.task.contentHash,task.contentHash);
    assert.equal((await ok(teacher.client.call('reopen-attempt',reopen))).attempt.id,rework.attempt.id);
    await ok(teacher.client.call('reopen-attempt',{...reopen,requestKey:randomUUID()}),409);
    assert.equal(f.sql('SELECT COUNT(*) AS n FROM school_attempts WHERE student_id=? AND assignment_id=?',[a.user.id,assignment.id])[0].n,2);
    assert.equal((await ok(a.client.call('begin-attempt',{assignmentId:assignment.id}))).attempt.id,rework.attempt.id);
  });
  await t.test('a delayed private result stays with the old sealed revision after rework starts',async()=>{
    const report={checkerVersion:claimed.checkerVersion,profileId:claimed.profileId,snapshotHash:claimed.snapshotHash,rubricHash:claimed.rubricHash,checkerHash:'c'.repeat(64),status:'evaluated',points:10,maxPoints:10,
      criteria:claimed.rubric.criteria.map(c=>({...c,points:c.maxPoints,explanation:'Test private worker delivery'}))};
    privateGrade('complete',{jobId:claimed.jobId,lease:claimed.lease,report});
    const old=await ok(a.client.call('attempt&id='+id)),next=await ok(a.client.call('attempt&id='+rework.attempt.id));
    assert.equal(old.submission.grading.points,10);assert.equal(next.attempt.grading.points,null);assert.deepEqual(old.snapshot.project,p);
    const roster=await ok(teacher.client.call('class-work&assignmentId='+assignment.id)),row=roster.rows.find(r=>r.student.id===a.user.id);
    assert.equal(row.status,'reopened');assert.equal(row.attempt.id,rework.attempt.id);assert.equal(row.attempt.number,2);assert.equal(row.lastSubmission.id,sealed.submission.id);assert.equal(row.lastSubmission.grading.points,10);
    const history=await ok(a.client.call('attempt-history&id='+rework.attempt.id));assert.deepEqual(history.attempts.map(v=>v.attempt.number),[2,1]);assert.equal(history.attempts[1].submission.grading.points,10);
    assert.deepEqual((await ok(a.client.call('attempt-history&id='+id+'&before=2'))).attempts.map(v=>v.attempt.number),[1]);
    for(const actor of [b,outsider])await ok(actor.client.call('attempt-history&id='+id),403);
  });
  await t.test('rework saves and seals independently; the last locked submission becomes current',async()=>{
    const project=structuredClone(rework.snapshot.project);project.files['main.py']='print("Dorada")';await ok(a.client.call('save-work',{attemptId:rework.attempt.id,expectedRevision:1,requestKey:randomUUID(),project}));
    const done=await ok(a.client.call('finish-attempt',{attemptId:rework.attempt.id,expectedRevision:2,requestKey:randomUUID()}));
    assert.notEqual(done.submission.id,sealed.submission.id);assert.equal(done.submission.grading.points,null);
    const row=(await ok(teacher.client.call('class-work&assignmentId='+assignment.id))).rows.find(r=>r.student.id===a.user.id);assert.equal(row.status,'locked');assert.equal(row.lastSubmission.id,done.submission.id);
    assert.equal((await ok(a.client.call('finish-attempt',body))).submission.id,sealed.submission.id);
    assert.equal((await ok(a.client.call('attempt&id='+id))).submission.grading.points,10);
  });
  await t.test('concurrent autosave and finish serialize: one exact snapshot is sealed and none is silently overwritten',async()=>{
    const opened=await ok(b.client.call('begin-attempt',{assignmentId:assignment.id})),second=f.client();await ok(second.login('finish.b',f.password));
    const changed=structuredClone(opened.snapshot.project);changed.files['main.py']='print("paralelno")';
    const finish={attemptId:opened.attempt.id,expectedRevision:1,requestKey:randomUUID()};
    const [end,saving]=await Promise.all([b.client.call('finish-attempt',finish),second.call('save-work',{attemptId:opened.attempt.id,expectedRevision:1,requestKey:randomUUID(),project:changed})]);
    assert.deepEqual([end.status,saving.status].sort(),[200,409]);
    if(end.status===409)await ok(b.client.call('finish-attempt',{...finish,expectedRevision:2}));
    const final=await ok(b.client.call('attempt&id='+opened.attempt.id));assert.equal(final.attempt.status,'locked');assert.equal(final.submission.revision,saving.status===200?2:1);
    assert.deepEqual(final.snapshot.project,saving.status===200?changed:opened.snapshot.project);
    assert.equal(f.sql('SELECT COUNT(*) AS n FROM school_submissions WHERE attempt_id=?',[opened.attempt.id])[0].n,1);
  });
  await t.test('repeat migrations preserve locked hashes, links and reports',()=>{
    const before=f.sql('SELECT id,attempt_id,revision,snapshot_hash FROM school_submissions ORDER BY id');const migration=f.command('migrate');assert.equal(migration.status,0,migration.stderr);
    assert.deepEqual(f.sql('SELECT id,attempt_id,revision,snapshot_hash FROM school_submissions ORDER BY id'),before);
    assert.equal(f.sql("SELECT COUNT(*) AS n FROM audit_events WHERE event='attempt.reopened'")[0].n,1);
  });
});
