import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {parseProject} from '../src/project/model.ts';
import {schoolFixture} from './school-http-fixture.mjs';

test('23D actual PHP/MySQL attempts, revisions, permissions and concurrency',{timeout:180000},async t=>{
  const f=await schoolFixture(t),teacher=await f.make('work.teacher','teacher'),other=await f.make('work.other','teacher'),a=await f.make('work.a'),b=await f.make('work.b');
  async function ok(p,status=200){const r=await p;assert.equal(r.status,status,r.text);return r.json;}
  const c=(await ok(teacher.client.call('create-class',{name:'4.f rad',schoolYear:'2026/2027'}),201)).class;
  async function addStudents(people){const csv='username;displayName\n'+people.map(p=>p.user.username+';'+p.user.displayName).join('\n');const plan=await ok(teacher.client.call('preview-students',{classId:c.id,csv}));await ok(teacher.client.call('import-students',{classId:c.id,csv,previewToken:plan.previewToken,linkExisting:true}));}
  await addStudents([a,b]);
  const task=(await ok(teacher.client.call('publish-task',{taskKey:'gpio/button',criteria:[{description:'Spoj',maxPoints:10}]}),201)).task;
  const assignment=(await ok(teacher.client.call('create-assignment',{classId:c.id,taskVersionId:task.id,target:'micropython'}),201)).assignment;
  let opened,attemptId,rev=1;
  await t.test('roster includes not-started pupils with no invented zero points',async()=>{
    const roster=await ok(teacher.client.call('class-work&assignmentId='+assignment.id));assert.equal(roster.rows.length,2);assert(roster.rows.every(r=>r.status==='not_started'&&r.attempt===null));
    await ok(other.client.call('class-work&assignmentId='+assignment.id),403);await ok(a.client.call('class-work&assignmentId='+assignment.id),403);
  });
  await t.test('parallel begin creates exactly one attempt and frozen initial snapshot',async()=>{
    const otherTab=f.client();await ok(otherTab.login('work.a',f.password));
    const pair=await Promise.all([ok(a.client.call('begin-attempt',{assignmentId:assignment.id})),ok(otherTab.call('begin-attempt',{assignmentId:assignment.id}))]);
    assert.equal(pair[0].attempt.id,pair[1].attempt.id);opened=pair[0];attemptId=opened.attempt.id;
    assert.equal(opened.attempt.revision,1);assert.equal(opened.student.id,a.user.id);assert.equal(opened.attempt.grading.points,null);
    assert.equal(f.sql('SELECT COUNT(*) AS n FROM work_snapshots WHERE attempt_id=?',[attemptId])[0].n,1);
    await ok(teacher.client.call('begin-attempt',{assignmentId:assignment.id}),403);
  });
  const payload=(project,expectedRevision=rev,requestKey=randomUUID())=>({attemptId,expectedRevision,requestKey,project});
  await t.test('snapshot stores source, wiring and answers; another device resumes the same attempt',async()=>{
    const p=structuredClone(opened.snapshot.project);p.files['main.py']+='\nprint("Nastavak na drugom uređaju")\n';const work=JSON.parse(p.files['urs-vjezba.json']);work.answers[0]='Moj odgovor <img src=x onerror=alert(1)>';p.files['urs-vjezba.json']=JSON.stringify(work);
    const saved=(await ok(a.client.call('save-work',payload(p)))).saved;assert.equal(saved.revision,++rev);
    const device=f.client();await ok(device.login('work.a',f.password));const resumed=await ok(device.call('begin-attempt',{assignmentId:assignment.id}));
    assert.equal(resumed.attempt.id,attemptId);assert.deepEqual(resumed.snapshot.project,p);assert.equal(resumed.snapshot.revision,rev);
    const seen=await ok(teacher.client.call('attempt&id='+attemptId));assert.deepEqual(seen.snapshot.project,p);
    const roster=await ok(teacher.client.call('class-work&assignmentId='+assignment.id));assert.equal(roster.rows.find(r=>r.student.id===a.user.id).attempt.revision,rev);
  });
  await t.test('lost response retries the same key without another revision, even after a newer save',async()=>{
    const p=structuredClone(opened.snapshot.project);p.files['main.py']='print("jednom")';const body=payload(p);
    const first=(await ok(a.client.call('save-work',body))).saved;assert.equal(first.revision,++rev);
    assert.deepEqual((await ok(a.client.call('save-work',body))).saved,first);
    const next=structuredClone(p);next.files['main.py']='print("novije")';await ok(a.client.call('save-work',payload(next)));++rev;
    const retry=(await ok(a.client.call('save-work',body))).saved;assert.equal(retry.revision,first.revision);assert.equal(retry.currentRevision,rev);
    await ok(a.client.call('save-work',{...body,project:next}),409);
  });
  await t.test('stale revision is rejected and two concurrent devices cannot overwrite each other',async()=>{
    const tab=f.client();await ok(tab.login('work.a',f.password));const one=structuredClone(opened.snapshot.project),two=structuredClone(one);one.files['main.py']='print("A")';two.files['main.py']='print("B")';
    const pair=await Promise.all([a.client.call('save-work',payload(one)),tab.call('save-work',payload(two))]);assert.deepEqual(pair.map(r=>r.status).sort(),[200,409]);++rev;
    await ok(a.client.call('save-work',payload(one,1)),409);
    assert.equal((await ok(a.client.call('attempt&id='+attemptId))).attempt.revision,rev);
  });
  await t.test('conflict recovery is an ordinary compare-and-swap after inspecting the latest snapshot',async()=>{
    const latest=await ok(a.client.call('attempt&id='+attemptId));const p=structuredClone(latest.snapshot.project);p.files['main.py']='print("Pregledao sam obje verzije")';
    await ok(a.client.call('save-work',payload(p,latest.snapshot.revision)));++rev;
    assert.equal((await ok(a.client.call('attempt&id='+attemptId+'&revision=1'))).snapshot.project.files['main.py'],opened.snapshot.project.files['main.py']);
    const history=await ok(a.client.call('attempt-revisions&id='+attemptId));assert.equal(history.revisions.length,rev);assert.equal(history.revisions[0].revision,rev);
  });
  await t.test('student impersonation, other classes and teacher writes are denied',async()=>{
    for(const client of [b.client,other.client])for(const action of ['attempt&id='+attemptId,'attempt-revisions&id='+attemptId])await ok(client.call(action),403);
    const p=opened.snapshot.project;for(const client of [b.client,other.client,teacher.client])await ok(client.call('save-work',payload(p)),403);
  });
  await t.test('wrong target, id, peer topology, unsafe files and oversize content do not create revisions',async()=>{
    const p=opened.snapshot.project;
    for(const edit of [v=>v.id=randomUUID(),v=>v.language='arduino-cpp',v=>v.board.id='arduino.uno-r3.atmega328p',v=>v.files['../bad.py']='x',v=>v.files['main.py']='x'.repeat(131073),v=>v.settings.fontSize=99,v=>{v.schemaVersion=4;v.radio={version:1,peer:p};}]){
      const v=structuredClone(p);edit(v);const r=await a.client.call('save-work',payload(v));assert([413,422].includes(r.status),r.text);
    }
    assert.equal((await ok(a.client.call('attempt&id='+attemptId))).attempt.revision,rev);
  });
  await t.test('local claimed scores and assignment names never change official identities or rubric',async()=>{
    const p=structuredClone(opened.snapshot.project);p.files['fake-points.json']=JSON.stringify({points:999,studentId:b.user.id});p.files['school-assignment.json']='{"points":999}';
    await ok(a.client.call('save-work',{...payload(p),points:999,studentId:b.user.id}));++rev;
    const read=await ok(teacher.client.call('attempt&id='+attemptId));assert.equal(read.student.id,a.user.id);assert.equal(read.assignment.task.rubric.maxPoints,10);assert.equal(read.attempt.grading.points,null);
  });
  await t.test('hidden assignments and revoked memberships immediately block reads and saves',async()=>{
    await ok(teacher.client.call('assignment-availability',{assignmentId:assignment.id,available:false}));await ok(a.client.call('attempt&id='+attemptId),403);await ok(a.client.call('save-work',payload(opened.snapshot.project)),403);
    await ok(teacher.client.call('assignment-availability',{assignmentId:assignment.id,available:true}));
    await ok(f.admin.call('membership',{classId:c.id,userId:a.user.id,kind:'student',present:false}));await ok(a.client.call('attempt&id='+attemptId),403);await ok(a.client.call('save-work',payload(opened.snapshot.project)),403);
    await addStudents([a]);
  });
  await t.test('all 268 URS and five introductory starter targets retain valid object fields, both radio nodes and media',async()=>{
    const catalog=(await ok(teacher.client.call('catalog'))).catalog;let count=0;
    for(const entry of catalog.entries){
      const version=(await ok(teacher.client.call('publish-task',{taskKey:entry.key}),201)).task;
      for(const target of entry.targets){
        const item=(await ok(teacher.client.call('create-assignment',{classId:c.id,taskVersionId:version.id,target}),201)).assignment;
        const start=await ok(a.client.call('begin-attempt',{assignmentId:item.id}));assert.deepEqual(parseProject(start.snapshot.project),start.snapshot.project,entry.key+' '+target);const body={attemptId:start.attempt.id,expectedRevision:1,requestKey:randomUUID(),project:start.snapshot.project};
        const saved=await ok(a.client.call('save-work',body));assert.equal(saved.saved.revision,2,entry.key+' '+target);
        if(start.snapshot.project.radio)assert(start.snapshot.project.radio.peer.files['main.py']||start.snapshot.project.radio.peer.files['main.ino']);++count;
      }
    }assert.equal(count,273);
  });
  await t.test('repeated migration preserves all snapshots and published versions',async()=>{
    const before=f.sql('SELECT COUNT(*) AS n FROM work_snapshots')[0].n;const r=f.command('migrate');assert.equal(r.status,0,r.stderr);
    assert.equal(f.sql('SELECT COUNT(*) AS n FROM work_snapshots')[0].n,before);assert.equal((await ok(a.client.call('attempt&id='+attemptId))).attempt.revision,rev);
  });
});
