import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {schoolFixture} from './school-http-fixture.mjs';
import {validateArtifact} from '../public/arduino-contract.mjs';
import {probeProject,targets} from '../school/compiler/runner.mjs';

test('25A real PHP/MySQL queue: isolation, idempotency, leases, limits and locked work',{timeout:180000},async t=>{
 const f=await schoolFixture(t,{compiler:true}),a=await f.make('compile.a'),b=await f.make('compile.b');
 const ok=async(p,status=200)=>{const r=await p;assert.equal(r.status,status,r.text);return r.json;};
 const cli=(action,input)=>{const r=spawnSync(process.env.PHP_BIN||'php',[join(f.pkg,'tools/compilation.php'),action,f.configPath],{input:input?JSON.stringify(input):'',encoding:'utf8',env:f.env});assert.equal(r.status,0,r.stderr);return JSON.parse(r.stdout);};
 const ready=Object.fromEntries(targets.map(t=>[t,{ready:true,message:'Test queue only'}]));
 cli('heartbeat',{targets:ready});
 const body=()=>({requestKey:randomUUID(),node:'A',project:probeProject(targets[0])});
 const first=body();first.project.files['secret.txt']='MUST NOT BE SENT TO COMPILER';
 const [x,y]=await Promise.all([ok(a.client.call('compile',first)),ok(b.client.call('compile',body()))]);
 await t.test('owners only and exact retry',async()=>{
  assert.notEqual(x.job.id,y.job.id);await ok(b.client.call('compile-status&id='+x.job.id),404);await ok(b.client.call('cancel-compile',{id:x.job.id}),404);
  assert.equal((await ok(a.client.call('compile',first))).job.id,x.job.id);
  const changed=structuredClone(first);changed.project.files['main.ino']+='//different';await ok(a.client.call('compile',changed),409);
  assert(!JSON.stringify(f.sql('SELECT project FROM compile_jobs WHERE id=?',[x.job.id])).includes('MUST NOT'));
 });
 await t.test('single worker slot; cancellation rejects late completion',async()=>{
  const {job}=cli('claim');assert(job);assert.equal(cli('claim').job,null);
  const owner=job.id===x.job.id?a:b;
  await ok(owner.client.call('cancel-compile',{id:job.id}));assert.equal(cli('active',job).active,false);
  assert.equal(cli('complete',{...job,result:{status:'compiled',artifact:{test:true}}}).accepted,false);
 });
 await t.test('expired worker and queue requests reach a final state',async()=>{
  const {job}=cli('claim');assert(job);f.sql('UPDATE compile_jobs SET lease_until=CURRENT_TIMESTAMP(6)-INTERVAL 1 SECOND WHERE id=?',[job.id]);cli('cleanup');
  assert.equal(f.sql('SELECT status FROM compile_jobs WHERE id=?',[job.id])[0].status,'technical_error');
  const j=(await ok(a.client.call('compile',body()))).job;f.sql('UPDATE compile_jobs SET created_at=CURRENT_TIMESTAMP(6)-INTERVAL 11 MINUTE WHERE id=?',[j.id]);assert.equal((await ok(a.client.call('compile-status&id='+j.id))).job.status,'technical_error');
 });
 await t.test('target readiness independent, source paths rejected, CSRF required',async()=>{
  cli('heartbeat',{targets:{...ready,[targets[2]]:{ready:false}}});const p=body();p.project=probeProject(targets[2]);await ok(a.client.call('compile',p),503);
  const invalid=body();invalid.project.files['../leak.h']='x';await ok(a.client.call('compile',invalid),422);
  const response=await fetch(f.origin+'/api/index.php?action=compile',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body())});assert.equal(response.status,403);
  cli('heartbeat',{targets:ready});
 });
 await t.test('per-user queue limit leaves capacity for a different account',async()=>{
  await ok(a.client.call('compile',body()));await ok(a.client.call('compile',body()));await ok(a.client.call('compile',body()),429);await ok(b.client.call('compile',body()));
  for(const row of f.sql("SELECT id,user_id FROM compile_jobs WHERE status='queued'"))await ok((row.user_id===a.user.id?a:b).client.call('cancel-compile',{id:row.id}));
 });
 await t.test('authorized attempt, locked submission, no work revision side effect',async()=>{
  const teacher=await f.make('compile.teacher','teacher');const c=(await ok(teacher.client.call('create-class',{name:'4.f',schoolYear:'2026/2027'}),201)).class;
  const csv='username;displayName\n'+a.user.username+';'+a.user.displayName;const plan=await ok(teacher.client.call('preview-students',{classId:c.id,csv}));await ok(teacher.client.call('import-students',{classId:c.id,csv,previewToken:plan.previewToken,linkExisting:true}));
  const task=(await ok(teacher.client.call('publish-task',{taskKey:'gpio/button',criteria:[{description:'Provjera',maxPoints:10}]}),201)).task;
  const assignment=(await ok(teacher.client.call('create-assignment',{classId:c.id,taskVersionId:task.id,target:'uno'}),201)).assignment;
  const work=await ok(a.client.call('begin-attempt',{assignmentId:assignment.id}));const p={...body(),attemptId:work.attempt.id,project:work.snapshot.project};
  const before=f.sql('SELECT COUNT(*) AS n FROM work_snapshots')[0].n;
  await ok(a.client.call('compile',p));assert.equal(f.sql('SELECT COUNT(*) AS n FROM work_snapshots')[0].n,before);
  await ok(b.client.call('compile',{...p,requestKey:randomUUID()}),403);
  f.sql("UPDATE school_attempts SET status='locked' WHERE id=?",[work.attempt.id]);await ok(a.client.call('compile',{...p,requestKey:randomUUID()}),409);
 });
 await t.test('retention deletes source and artifact before deleting expired metadata',async()=>{
  f.sql("UPDATE compile_jobs SET status='technical_error',finished_at=CURRENT_TIMESTAMP(6)-INTERVAL 2 DAY WHERE status='queued'");cli('cleanup');
  for(const r of f.sql("SELECT project,result FROM compile_jobs WHERE status='expired'")){assert.equal(r.project,null);assert.equal(r.result,null);}
 });
 await t.test('packaged worker compiles through the real queue and returns a validated browser artifact',{skip:!process.env.LAB_ARDUINO_CLI,timeout:240000},async()=>{
  cli('heartbeat',{targets:ready});const input=body();input.project.files['main.ino']=input.project.files['main.ino'].replace('731','913');
  const job=(await ok(b.client.call('compile',input))).job;
  const worker=spawnSync(process.execPath,[join(f.pkg,'tools/compiler-worker.mjs'),'--once'],{env:f.env,encoding:'utf8',timeout:240000});assert.equal(worker.status,0,worker.stderr+worker.stdout);
  const completed=(await ok(b.client.call('compile-status&id='+job.id))).job;assert.equal(completed.status,'compiled',JSON.stringify(completed));await validateArtifact(input.project,completed.result.artifact);
 });

});
