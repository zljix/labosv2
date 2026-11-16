import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {schoolFixture} from './school-http-fixture.mjs';
import {gradeJob} from '../school/grader/official.ts';

test('23E actual PHP/MySQL queue, isolated results, immutable binding, permissions and delayed completion',{timeout:180000},async t=>{
  const f=await schoolFixture(t),teacher=await f.make('grade.teacher','teacher'),other=await f.make('grade.other','teacher'),a=await f.make('grade.a'),b=await f.make('grade.b');
  await t.test('grading retries roll back partial writes; non-transient failures are not retried and repeated conflicts remain bounded',()=>{
    const code=String.raw`require getenv("LAB_TEST_BOOTSTRAP");
      $p=Labos\database(Labos\configuration());
      $p->exec("CREATE TABLE grading_retry_probe (id INT PRIMARY KEY) ENGINE=InnoDB");
      $attempts=0;
      Labos\gradingTransaction($p,function()use($p,&$attempts){
        $attempts++;$p->exec("INSERT INTO grading_retry_probe VALUES(1)");
        if($attempts<3)$p->exec("SIGNAL SQLSTATE '40001' SET MYSQL_ERRNO=1213, MESSAGE_TEXT='synthetic grading conflict'");
      });
      if($attempts!==3||(int)$p->query("SELECT COUNT(*) FROM grading_retry_probe")->fetchColumn()!==1||$p->inTransaction())throw new Exception('Retry duplicated a write');
      $p->exec("DELETE FROM grading_retry_probe");$attempts=0;
      try{Labos\gradingTransaction($p,function()use($p,&$attempts){$attempts++;$p->exec("INSERT INTO grading_retry_probe VALUES(1)");$p->exec("SIGNAL SQLSTATE '45000' SET MYSQL_ERRNO=1644");});throw new Exception('Expected permanent failure');}
      catch(PDOException $e){if($attempts!==1)throw new Exception('Permanent failure retried');}
      if((int)$p->query("SELECT COUNT(*) FROM grading_retry_probe")->fetchColumn()!==0)throw new Exception('Partial permanent write survived');
      $attempts=0;
      try{Labos\gradingTransaction($p,function()use($p,&$attempts){$attempts++;$p->exec("INSERT INTO grading_retry_probe VALUES(1)");$p->exec("SIGNAL SQLSTATE '40001' SET MYSQL_ERRNO=1213");});throw new Exception('Expected bounded conflict');}
      catch(PDOException $e){if($attempts<2||$attempts>8)throw new Exception('Unbounded retries');}
      if((int)$p->query("SELECT COUNT(*) FROM grading_retry_probe")->fetchColumn()!==0||$p->inTransaction())throw new Exception('Partial exhausted write survived');
      $p->exec("DROP TABLE grading_retry_probe");echo "GRADING_RETRY_ATOMIC_OK";`;
    const r=spawnSync(process.env.PHP_BIN||'php',['-r',code],{encoding:'utf8',env:f.env});assert.equal(r.status,0,r.stderr);assert.equal(r.stdout,'GRADING_RETRY_ATOMIC_OK');
  });
  const ok=async(p,status=200)=>{const r=await p;assert.equal(r.status,status,r.text);return r.json;};
  const c=(await ok(teacher.client.call('create-class',{name:'4.f bodovanje',schoolYear:'2026/2027'}),201)).class;
  const csv='username;displayName\n'+[a,b].map(p=>p.user.username+';'+p.user.displayName).join('\n');
  const preview=await ok(teacher.client.call('preview-students',{classId:c.id,csv}));await ok(teacher.client.call('import-students',{classId:c.id,csv,previewToken:preview.previewToken,linkExisting:true}));
  const profiles=(await ok(teacher.client.call('catalog'))).catalog.gradingProfiles;assert.deepEqual(profiles,JSON.parse(readFileSync('school/grader/profiles.json','utf8')).profiles);
  const publish=async(i=0)=> (await ok(teacher.client.call('publish-task',{taskKey:profiles[i].taskKey,gradingProfile:profiles[i].id}),201)).task;
  const task=await publish(),assignment=(await ok(teacher.client.call('create-assignment',{classId:c.id,taskVersionId:task.id,target:'micropython'}),201)).assignment;
  const privateCall=(action,body)=>{const r=f.gradingCommand(action,body);assert.equal(r.status,0,r.stderr);return JSON.parse(r.stdout);};
  let opened,job,report;
  await t.test('explicit pilot publication freezes criteria; descriptive and unsupported targets retain null points',async()=>{
    assert.equal(task.rubric.authority,'server-verified');assert.equal(task.rubric.maxPoints,10);assert.match(task.rubric.instructions,/tipkalo/);
    await ok(teacher.client.call('publish-task',{taskKey:'gpio/adc',gradingProfile:profiles[0].id}),422);
    await ok(teacher.client.call('publish-task',{taskKey:'gpio/button',gradingProfile:profiles[0].id,criteria:[{description:'Drukčije',maxPoints:99}]}),422);
    const descriptive=(await ok(teacher.client.call('publish-task',{taskKey:'gpio/button'}),201)).task;assert.equal(descriptive.rubric.authority,'not-yet-enabled');
    const s3=(await ok(teacher.client.call('create-assignment',{classId:c.id,taskVersionId:task.id,target:'s3-cpp'}),201)).assignment;
    assert.equal((await ok(a.client.call('begin-attempt',{assignmentId:s3.id}))).attempt.grading.status,'unsupported');
    const before=(await ok(teacher.client.call('class-work&assignmentId='+assignment.id))).rows;assert(before.every(r=>r.attempt===null));
  });
  await t.test('opening queues one exact snapshot; repeated requests are idempotent and cannot supply points',async()=>{
    opened=await ok(a.client.call('begin-attempt',{assignmentId:assignment.id}));assert.equal(opened.attempt.grading.status,'queued');assert.equal(opened.attempt.grading.points,null);
    const body={attemptId:opened.attempt.id,expectedRevision:1,requestKey:randomUUID(),points:999,report:{points:999}};
    await ok(a.client.call('request-grade',body));await ok(a.client.call('request-grade',body));
    assert.equal(f.sql('SELECT COUNT(*) AS n FROM grading_jobs WHERE attempt_id=?',[opened.attempt.id])[0].n,1);
    job=privateCall('claim').job;assert.equal(job.revision,1);assert.equal(job.snapshotHash,opened.snapshot.contentHash);assert.equal(job.rubricHash,task.contentHash);
    assert.equal(createHash('sha256').update(job.projectJson).digest('hex'),job.snapshotHash,'MySQL JSON is canonicalized before export');
    const publicResult=await ok(a.client.call('grading&id='+opened.attempt.id));assert(!JSON.stringify(publicResult).includes(job.lease));assert(!JSON.stringify(publicResult).includes(job.seed));
    assert.equal(publicResult.grading.status,'running');
  });
  await t.test('student and teacher scope applies to results and request routes; HTTP cannot claim or complete',async()=>{
    for(const client of [b.client,other.client])await ok(client.call('grading&id='+opened.attempt.id),403);
    for(const client of [b.client,teacher.client,other.client])await ok(client.call('request-grade',{attemptId:opened.attempt.id,expectedRevision:1,requestKey:randomUUID()}),403);
    await ok(a.client.call('claim'),404);await ok(a.client.call('complete',{points:10}),404);
    await ok(teacher.client.call('grading&id='+opened.attempt.id));
  });
  await t.test('real sandbox result is accepted once and contains explanations; a lost response can be repeated',async()=>{
    report=await gradeJob(job,{root:process.cwd()});assert.equal(report.points,10,JSON.stringify(report));
    const body={jobId:job.jobId,lease:job.lease,report};privateCall('complete',body);privateCall('complete',body);
    const g=(await ok(a.client.call('grading&id='+opened.attempt.id))).grading;assert.equal(g.points,10);assert.equal(g.revision,1);assert.equal(g.report.criteria.length,3);
    const roster=(await ok(teacher.client.call('class-work&assignmentId='+assignment.id))).rows;assert.equal(roster.find(r=>r.student.id===a.user.id).attempt.grading.points,10);
    assert.equal(f.sql("SELECT COUNT(*) AS n FROM audit_events WHERE event='grading.completed'")[0].n,1);
  });
  await t.test('later save immediately loses old current points; late result stays attached to its old snapshot',async()=>{
    const save=async(rev,text)=>{const p=structuredClone(opened.snapshot.project);p.files['main.py']=text;return ok(a.client.call('save-work',{attemptId:opened.attempt.id,expectedRevision:rev,requestKey:randomUUID(),project:p,points:999}));};
    await save(1,'print("revision 2")');const old=privateCall('claim').job;assert.equal(old.revision,2);
    await save(2,'print("revision 3")');const now=await ok(a.client.call('attempt&id='+opened.attempt.id));assert.equal(now.attempt.grading.points,null);assert.equal(now.attempt.grading.revision,3);
    const oldReport=await gradeJob(old,{root:process.cwd()});privateCall('complete',{jobId:old.jobId,lease:old.lease,report:oldReport});
    const current=await ok(a.client.call('attempt&id='+opened.attempt.id));assert.equal(current.attempt.grading.points,null);assert.equal(current.snapshot.revision,3);
    const previous=await ok(a.client.call('attempt&id='+opened.attempt.id+'&revision=2'));assert.equal(previous.snapshot.grading.report.status,'program_error');
    const roster=(await ok(teacher.client.call('class-work&assignmentId='+assignment.id))).rows;assert.equal(roster.find(r=>r.student.id===a.user.id).attempt.grading.points,null);
    await ok(a.client.call('request-grade',{attemptId:opened.attempt.id,expectedRevision:2,requestKey:randomUUID()}),409);
  });
  await t.test('expired lease and altered result binding or point sum are rejected; service failure never becomes zero',async()=>{
    const live=privateCall('claim').job,r=await gradeJob(live,{root:process.cwd()});
    for(const change of [{snapshotHash:'a'.repeat(64)},{points:99},{rubricHash:'a'.repeat(64)}]){
      const bad=f.gradingCommand('complete',{jobId:live.jobId,lease:live.lease,report:{...r,...change}});assert.equal(bad.status,2,bad.stdout);
    }
    const technical={...r,status:'technical_error',points:null,message:'Servis nije dostupan.'};delete technical.criteria;delete technical.samples;
    privateCall('complete',{jobId:live.jobId,lease:live.lease,report:technical});assert.equal((await ok(a.client.call('grading&id='+opened.attempt.id))).grading.points,null);
    const retry=await ok(a.client.call('request-grade',{attemptId:opened.attempt.id,expectedRevision:3,requestKey:randomUUID()}));assert.equal(retry.grading.status,'queued');
    const expired=privateCall('claim').job;f.sql('UPDATE grading_jobs SET lease_until=CURRENT_TIMESTAMP(6)-INTERVAL 1 SECOND WHERE id=?',[expired.jobId]);
    const bad=f.gradingCommand('complete',{jobId:expired.jobId,lease:expired.lease,report:{...technical,snapshotHash:expired.snapshotHash}});assert.equal(bad.status,2);
    privateCall('claim');assert.equal(f.sql('SELECT status FROM grading_jobs WHERE id=?',[expired.jobId])[0].status,'technical_error');
  });
  await t.test('queued old revisions are superseded; a later rubric publication never changes the frozen one',async()=>{
    const p=structuredClone(opened.snapshot.project);
    for(let revision=3;revision<5;revision++)await ok(a.client.call('save-work',{attemptId:opened.attempt.id,expectedRevision:revision,requestKey:randomUUID(),project:p}));
    assert.equal(f.sql("SELECT status FROM grading_jobs WHERE attempt_id=? AND revision=4",[opened.attempt.id])[0].status,'superseded');
    const newer=await publish();assert.equal(newer.version,task.version+2); // descriptive version was published in the first scenario
    assert.equal((await ok(a.client.call('attempt&id='+opened.attempt.id))).assignment.task.contentHash,task.contentHash);
    const count=f.sql('SELECT COUNT(*) AS n FROM grading_jobs')[0].n;assert.equal(f.command('migrate').status,0);assert.equal(f.sql('SELECT COUNT(*) AS n FROM grading_jobs')[0].n,count);
  });
  await t.test('23G expanded profiles publish with distinct checker versions and never revise old task rubrics',async()=>{
    const catalog=(await ok(teacher.client.call('catalog'))).catalog;
    assert.deepEqual(catalog.gradingSummary,JSON.parse(readFileSync('public/school-grading-support.json','utf8')).summary);
    const entry=catalog.entries.find(e=>e.key==='analog/lm35');assert.equal(entry.gradingSupport['s3-cpp'].maxPoints,10);
    assert.equal(task.rubric.checkerVersion,'23E.1');
    const profile=profiles.find(p=>p.id==='23G-lm35@1');
    const expanded=(await ok(teacher.client.call('publish-task',{taskKey:profile.taskKey,gradingProfile:profile.id}),201)).task;
    assert.equal(expanded.rubric.checkerVersion,'23G.1');
    const assign=(await ok(teacher.client.call('create-assignment',{classId:c.id,taskVersionId:expanded.id,target:'micropython'}),201)).assignment;
    const begin=await ok(a.client.call('begin-attempt',{assignmentId:assign.id}));
    f.sql("UPDATE grading_jobs SET status='superseded' WHERE attempt_id<>? AND status='queued'",[begin.attempt.id]);
    const queued=privateCall('claim').job;assert.equal(queued.profileId,profile.id);assert.equal(queued.checkerVersion,'23G.1');
    const result=await gradeJob(queued,{root:process.cwd()});assert.equal(result.points,10,JSON.stringify(result));
    privateCall('complete',{jobId:queued.jobId,lease:queued.lease,report:result});
    assert.equal((await ok(a.client.call('attempt&id='+begin.attempt.id))).attempt.grading.points,10);
    assert.equal((await ok(a.client.call('attempt&id='+opened.attempt.id))).assignment.task.contentHash,task.contentHash);
  });
});
