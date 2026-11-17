import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {schoolFixture} from './school-http-fixture.mjs';

test('23C classes, admission, immutable tasks and assignments against real PHP/MySQL',{timeout:180000},async t=>{
  const f=await schoolFixture(t),{admin,sql}=f;
  const teacher=await f.make('teacher.one','teacher','Nastavnik Jedan'),other=await f.make('teacher.other','teacher','Drugi Nastavnik');
  const student=await f.make('student.one','student','Učenik Jedan'),outsider=await f.make('student.out','student','Drugi Učenik');
  let classId,otherId,invite,task,assignment;
  const expect=async(p,status)=>{const r=await p;assert.equal(r.status,status,r.text);return r.json;};
  const preview=csv=>teacher.client.call('preview-students',{classId,csv});
  async function importCsv(csv,linkExisting=false){const p=await expect(preview(csv),200);return expect(teacher.client.call('import-students',{classId,csv,previewToken:p.previewToken,linkExisting}),200);}

  await t.test('teachers create their own classes; school year and unique names are checked',async()=>{
    classId=(await expect(teacher.client.call('create-class',{name:'4.f',schoolYear:'2026/2027'}),201)).class.id;
    otherId=(await expect(other.client.call('create-class',{name:'3.e',schoolYear:'2026/2027'}),201)).class.id;
    await expect(teacher.client.call('create-class',{name:'4.f',schoolYear:'2026/2027'}),409);
    await expect(teacher.client.call('create-class',{name:'4.x',schoolYear:'2026/2028'}),422);
    await expect(student.client.call('create-class',{name:'Sam',schoolYear:'2026/2027'}),403);
    assert.deepEqual((await expect(teacher.client.call('classes'),200)).classes.map(c=>c.id),[classId]);
    assert.equal((await expect(admin.call('classes'),200)).classes.length,2);
    await expect(teacher.client.call('class&id='+otherId),403);await expect(student.client.call('class&id='+classId),403);
  });
  await t.test('only administrators can assign teachers and only correct active roles qualify',async()=>{
    await expect(teacher.client.call('membership',{classId,userId:other.user.id,kind:'teacher',present:true}),403);
    await expect(admin.call('membership',{classId,userId:student.user.id,kind:'teacher',present:true}),422);
    await expect(admin.call('membership',{classId,userId:other.user.id,kind:'teacher',present:true}),200);
    assert.equal((await expect(other.client.call('class&id='+classId),200)).class.teachers.length,2);
    await expect(admin.call('membership',{classId,userId:other.user.id,kind:'teacher',present:false}),200);
    await expect(other.client.call('class&id='+classId),403);
  });
  await t.test('CSV preview never returns passwords; reviewed existing identity needs explicit consent',async()=>{
    const csv='\ufeffusername;displayName;temporaryPassword\nstudent.one;Učenik Jedan;\nnew.one;Nova Učenica;'+f.temporary+'\n';
    const p=await expect(preview(csv),200);assert.deepEqual(p.rows.map(r=>r.action),['link','create']);assert(!JSON.stringify(p).includes(f.temporary));
    await expect(teacher.client.call('import-students',{classId,csv,previewToken:p.previewToken}),422);
    assert.equal(sql("SELECT COUNT(*) AS n FROM users WHERE username='new.one'")[0].n,0);
    const result=await expect(teacher.client.call('import-students',{classId,csv,previewToken:p.previewToken,linkExisting:true}),200);assert.equal(result.created,1);assert.equal(result.added,2);
    const fresh=sql("SELECT password_hash,must_change_password FROM users WHERE username='new.one'")[0];assert(fresh.must_change_password);assert.notEqual(fresh.password_hash,f.temporary);
    assert.deepEqual((await expect(teacher.client.call('users'),200)).users.map(u=>u.username).sort(),['new.one','student.one']);
    const repeat=await importCsv('username,displayName\nstudent.one,Učenik Jedan');assert.equal(repeat.unchanged,1);
  });
  await t.test('CSV rejects duplicates, malformed rows, bad identity, staff roles, oversized lists and silent resets',async()=>{
    for(const [csv,status] of [
      ['username;displayName\nstudent.one;Pogrešno Ime',409],
      ['username;displayName;temporaryPassword\nstudent.one;Učenik Jedan;'+f.temporary,422],
      ['username;displayName\nteacher.one;Nastavnik Jedan',409],
      ['username;displayName\nstudent.one;Učenik Jedan\nSTUDENT.ONE;Učenik Jedan',422],
      ['name;password\ntest;pass',422],
      ['username;displayName;temporaryPassword\nnew.two;Nova Osoba;short',422],
      ['username;displayName\nstudent.one;Učenik Jedan;extra',422],
      ['username;displayName;temporaryPassword\n'+Array.from({length:101},(_,i)=>'many.'+i+';Osoba '+i+';'+f.temporary).join('\n'),422]
    ])await expect(preview(csv),status);
    await expect(other.client.call('preview-students',{classId,csv:'username;displayName\nstudent.one;Učenik Jedan'}),403);
    await expect(student.client.call('preview-students',{classId,csv:''}),403);
  });
  await t.test('CSV preview is bound to exact data, class, actor and current account state',async()=>{
    const csv='username;displayName;temporaryPassword\nnew.two;Nova Dva;'+f.temporary;const p=await expect(preview(csv),200);
    await expect(teacher.client.call('import-students',{classId,csv:csv.replace('Nova Dva','Nova Tri'),previewToken:p.previewToken}),409);
    await expect(other.client.call('import-students',{classId:otherId,csv,previewToken:p.previewToken}),409);
    await expect(teacher.client.call('import-students',{classId,csv,previewToken:'1234567890.'+'0'.repeat(64)}),409);
    await f.make('new.two','student','Nova Dva');
    await expect(teacher.client.call('import-students',{classId,csv,previewToken:p.previewToken}),422);
    assert.equal(sql("SELECT COUNT(*) AS n FROM class_students s JOIN users u ON u.id=s.student_id WHERE username='new.two'")[0].n,0);
  });
  await t.test('invite codes have bounds, are displayed once and are not stored in plaintext',async()=>{
    await expect(teacher.client.call('create-invite',{classId,hours:0,maxUses:30}),422);
    await expect(other.client.call('create-invite',{classId,hours:1,maxUses:1}),403);
    invite=(await expect(teacher.client.call('create-invite',{classId,hours:24,maxUses:10}),201)).invite;
    assert.match(invite.code,/^[A-F0-9]{24}$/);
    assert.notEqual(sql('SELECT code_hash FROM class_invites WHERE id=?',[invite.id])[0].code_hash,invite.code);
    assert(!(await expect(teacher.client.call('class&id='+classId),200)).class.invites.some(i=>i.code));
  });
  await t.test('anonymous registration creates only a student and grants no class access before approval',async()=>{
    const anon=f.client();await anon.call('session');
    await expect(anon.call('register',{code:'F'.repeat(24),username:'join.new',displayName:'Nova Registracija',password:f.password}),422);
    await expect(anon.call('register',{code:invite.code.toLowerCase(),username:'join.new',displayName:'Nova Registracija',password:f.password,role:'admin',classId:otherId}),201);
    assert.equal(sql("SELECT role FROM users WHERE username='join.new'")[0].role,'student');
    const c=f.client();await expect(c.login('join.new',f.password),200);assert.equal((await expect(c.call('classes'),200)).classes.length,0);
    assert.equal((await expect(c.call('assignments'),200)).assignments.length,0);await expect(c.call('assignment&id=1'),403);
    const requests=(await expect(teacher.client.call('class&id='+classId),200)).class.requests;
    assert.equal(requests.length,1);await expect(other.client.call('review-join',{requestId:requests[0].id,approve:true}),403);
    await expect(teacher.client.call('review-join',{requestId:requests[0].id,approve:true}),200);
    assert.equal((await expect(c.call('classes'),200)).classes[0].id,classId);
    await expect(teacher.client.call('review-join',{requestId:requests[0].id,approve:true}),409);
    assert.equal((await expect(c.call('my-requests'),200)).requests[0].status,'approved');
  });
  await t.test('existing pupils request admission without replacing identity or password; replay uses no extra quota',async()=>{
    const before=sql('SELECT used_count FROM class_invites WHERE id=?',[invite.id])[0].used_count;
    await expect(outsider.client.call('join-class',{code:invite.code,displayName:'Krivotvoreno',role:'teacher'}),200);
    await expect(outsider.client.call('join-class',{code:invite.code}),200);
    assert.equal(sql('SELECT used_count FROM class_invites WHERE id=?',[invite.id])[0].used_count,before+1);
    assert.equal((await expect(outsider.client.call('classes'),200)).classes.length,0);
    const request=(await expect(teacher.client.call('class&id='+classId),200)).class.requests[0];assert.equal(request.student.displayName,'Drugi Učenik');
    await expect(teacher.client.call('review-join',{requestId:request.id,approve:false}),200);
    assert.equal((await expect(outsider.client.call('my-requests'),200)).requests[0].status,'rejected');
    await expect(teacher.client.call('join-class',{code:invite.code}),403);
  });
  await t.test('revocation, expiry and simultaneous last-slot registration are enforced atomically',async()=>{
    await expect(teacher.client.call('revoke-invites',{classId}),200);await expect(outsider.client.call('join-class',{code:invite.code}),422);
    const expired=(await expect(teacher.client.call('create-invite',{classId,hours:1,maxUses:2}),201)).invite;
    sql('UPDATE class_invites SET expires_at=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 1 SECOND) WHERE id=?',[expired.id]);await expect(outsider.client.call('join-class',{code:expired.code}),422);
    const last=(await expect(teacher.client.call('create-invite',{classId,hours:1,maxUses:1}),201)).invite;
    const a=f.client(),b=f.client();await a.call('session');await b.call('session');
    const results=await Promise.all([a.call('register',{code:last.code,username:'race.one',displayName:'Utrka Jedan',password:f.password}),b.call('register',{code:last.code,username:'race.two',displayName:'Utrka Dva',password:f.password})]);
    assert.deepEqual(results.map(r=>r.status).sort(),[201,422]);assert.equal(sql('SELECT used_count FROM class_invites WHERE id=?',[last.id])[0].used_count,1);
    assert.equal(sql("SELECT COUNT(*) AS n FROM users WHERE username IN ('race.one','race.two')")[0].n,1);
  });
  await t.test('school catalogue uses 67 URS variants, 268 URS targets and five introductory tasks without exposing template paths',async()=>{
    const catalog=(await expect(teacher.client.call('catalog'),200)).catalog;assert.equal(catalog.entries.length,72);assert.equal(catalog.entries.filter(e=>e.set==='urs').reduce((n,e)=>n+e.targets.length,0),268);assert.equal(catalog.entries.filter(e=>e.set==='introductory').length,5);assert(catalog.entries.every(e=>!e.templates));
    await expect(student.client.call('catalog'),403);await expect(student.client.call('task-versions'),403);
    for(const key of ['gpio/button','gpio/adc','weather/bmp280'])assert(catalog.entries.some(e=>e.key===key));
  });
  await t.test('publication takes trusted definitions and starter snapshots; only notes and rubric are teacher inputs',async()=>{
    task=(await expect(teacher.client.call('publish-task',{taskKey:'gpio/button',teacherNotes:'Stara uputa: usporedi pritisak i otpuštanje.',criteria:[{description:'Spoj',maxPoints:3},{description:'Reakcija na tipkalo',maxPoints:5},{description:'Početno stanje',maxPoints:2}],definition:{title:'Podmetnuto'},starters:{},role:'admin'}),201)).task;
    assert.equal(task.version,1);assert.equal(task.rubric.maxPoints,10);assert.equal(task.rubric.authority,'not-yet-enabled');assert.notEqual(task.definition.title,'Podmetnuto');
    await expect(student.client.call('publish-task',{taskKey:'gpio/button'}),403);
    await expect(teacher.client.call('publish-task',{taskKey:'../../config.php'}),422);
    await expect(teacher.client.call('publish-task',{taskKey:'gpio/button',criteria:[{description:'Greška',maxPoints:-1}]}),422);
  });
  await t.test('teacher assigns three pilot exercises with exact board/language and optional Zagreb-display UTC deadline',async()=>{
    const due='2026-12-01T10:30:00.000Z';assignment=(await expect(teacher.client.call('create-assignment',{classId,taskVersionId:task.id,target:'micropython',dueAt:due}),201)).assignment;
    assert.equal(new Date(assignment.dueAt).toISOString(),due);assert.equal(assignment.task.id,task.id);
    for(const key of ['gpio/adc','weather/bmp280']){const v=(await expect(teacher.client.call('publish-task',{taskKey:key}),201)).task;await expect(teacher.client.call('create-assignment',{classId,taskVersionId:v.id,target:'uno'}),201);}
    const items=(await expect(student.client.call('assignments'),200)).assignments;assert.equal(items.length,3);assert(items.every(a=>a.classId===classId));
    await expect(teacher.client.call('create-assignment',{classId:otherId,taskVersionId:task.id,target:'uno'}),403);
    await expect(student.client.call('create-assignment',{classId,taskVersionId:task.id,target:'uno'}),403);
    await expect(teacher.client.call('create-assignment',{classId,taskVersionId:task.id,target:'esp32'}),422);
    await expect(teacher.client.call('create-assignment',{classId,taskVersionId:task.id,target:'uno',dueAt:'2026-11-31T10:00:00Z'}),422);
  });
  await t.test('students see only their available assignments; raw access to another class and hidden tasks is refused',async()=>{
    const otherTask=(await expect(other.client.call('publish-task',{taskKey:'gpio/blink'}),201)).task;
    const foreign=(await expect(other.client.call('create-assignment',{classId:otherId,taskVersionId:otherTask.id,target:'nano'}),201)).assignment;
    await expect(student.client.call('assignment&id='+foreign.id),403);await expect(teacher.client.call('assignment&id='+foreign.id),403);
    await expect(outsider.client.call('assignment&id='+assignment.id),403);
    await expect(teacher.client.call('assignment-availability',{assignmentId:assignment.id,available:false}),200);
    assert.equal((await expect(student.client.call('assignments'),200)).assignments.length,2);await expect(student.client.call('assignment&id='+assignment.id),403);
    await expect(teacher.client.call('assignment&id='+assignment.id),200);await expect(teacher.client.call('assignment-availability',{assignmentId:assignment.id,available:true}),200);
    const value=(await expect(student.client.call('assignment&id='+assignment.id),200)).assignment;
    assert.equal(value.starter.language,'micropython');assert(value.starter.files['main.py']);assert(!value.starter.files['main.ino']);
  });
  await t.test('new rubric, instructions and changed installed templates cannot change any prior assignment',async()=>{
    const before=(await expect(student.client.call('assignment&id='+assignment.id),200)).assignment;
    const path=join(f.pkg,'catalog/gpio-button-micropython.json'),bytes=readFileSync(path),changed=JSON.parse(bytes);changed.files['main.py']+='\n# drugi predlozak\n';writeFileSync(path,JSON.stringify(changed));
    const next=(await expect(teacher.client.call('publish-task',{taskKey:'gpio/button',teacherNotes:'Nova uputa',criteria:[{description:'Novi kriterij',maxPoints:20}]}),201)).task;
    assert.equal(next.version,2);assert.notEqual(next.contentHash,task.contentHash);
    assert.deepEqual((await expect(student.client.call('assignment&id='+assignment.id),200)).assignment,before);
    const nextAssignment=(await expect(teacher.client.call('create-assignment',{classId,taskVersionId:next.id,target:'micropython'}),201)).assignment;
    const fresh=(await expect(student.client.call('assignment&id='+nextAssignment.id),200)).assignment;assert.match(fresh.starter.files['main.py'],/drugi predlozak/);assert.equal(fresh.task.rubric.maxPoints,20);writeFileSync(path,bytes);
  });
  await t.test('membership removal immediately removes access; migrations preserve users, assignments and frozen sources',async()=>{
    const before=sql('SELECT id,content_hash FROM task_versions ORDER BY id'),users=sql('SELECT id,password_hash FROM users ORDER BY id');
    assert.equal(f.command('migrate').status,0);assert.deepEqual(sql('SELECT id,content_hash FROM task_versions ORDER BY id'),before);assert.deepEqual(sql('SELECT id,password_hash FROM users ORDER BY id'),users);
    await expect(teacher.client.call('membership',{classId,userId:student.user.id,kind:'student',present:false}),200);
    assert.equal((await expect(student.client.call('assignments'),200)).assignments.length,0);await expect(student.client.call('assignment&id='+assignment.id),403);
    assert.equal(sql('SELECT COUNT(*) AS n FROM class_assignments')[0].n,5);
  });
  await t.test('audit and API omit credentials and invite secrets; private catalogue cannot be fetched from web',async()=>{
    const events=JSON.stringify(sql('SELECT event,details FROM audit_events'));assert(events.includes('task.published'));assert(events.includes('class.join_reviewed'));assert(!events.includes(invite.code));assert(!events.includes(f.temporary));assert(!f.log.includes(f.password));
    for(const path of ['catalog/catalog.json','catalog/gpio-button-micropython.json','migrations/003_classes_tasks.sql','app/tasks.php'])assert.equal((await fetch(f.origin+'/'+path)).status,404,path);
  });
});
