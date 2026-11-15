import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseProject,editProject} from '../src/project/model';
import {SchoolApi,SchoolApiError,SchoolSynchronizer,prepareSchoolAttempt,readSchoolBinding,schoolSnapshot,schoolFingerprint,detachedSchoolProject,type SyncState,type SchoolWorkState,type SchoolBinding} from '../src/platform/schoolSync';

const source=()=>parseProject(JSON.parse(readFileSync('.build/school-catalog/gpio-button-micropython.json','utf8')));
async function fixture(save?:any){
  const p=await prepareSchoolAttempt({attempt:{id:1,assignmentId:2,studentId:3,revision:1,status:'in_progress',savedAt:'2026-11-15T10:00:00Z'},snapshot:{revision:1,project:source(),contentHash:'a'.repeat(64),savedAt:'2026-11-15T10:00:00Z'},assignment:{},student:{id:3,username:'u',displayName:'Učenik'}} as SchoolWorkState,'https://school.test');
  let now=0,nextId=0;const timers=new Map<number,{at:number;fn:()=>void}>(),calls:any[]=[],states:SyncState[]=[],confirmations:SchoolBinding[]=[];
  const sync=new SchoolSynchronizer({binding:readSchoolBinding(p)!,api:{save:save??(async(_b:any,body:any)=>{calls.push(structuredClone(body));return {attemptId:1,revision:body.expectedRevision+1,currentRevision:body.expectedRevision+1,savedAt:'2026-11-15T10:10:00Z'};})},onState:s=>states.push(s),onConfirm:b=>confirmations.push(b),now:()=>now,later:(fn,ms)=>{const id=++nextId;timers.set(id,{at:now+ms,fn});return id;},cancel:id=>timers.delete(id)});
  const flush=()=>new Promise<void>(resolve=>setImmediate(resolve));
  async function advance(ms:number){const target=now+ms;while(true){const due=[...timers].filter(([,v])=>v.at<=target).sort((a,b)=>a[1].at-b[1].at)[0];if(!due)break;now=due[1].at;timers.delete(due[0]);due[1].fn();await flush();}now=target;await flush();}
  await sync.update(p);return {p,sync,calls,states,confirmations,advance,flush,timers};
}

test('school content fingerprint ignores local identity and sync bookkeeping but includes code, circuit, answers and peer',async()=>{
  const f=await fixture();const p=structuredClone(f.p),before=await schoolFingerprint(p);p.id=crypto.randomUUID();p.revision++;p.updatedAt=new Date().toISOString();p.files['school-attempt.json']='changed';assert.equal(await schoolFingerprint(p),before);
  for(const edit of [(v:any)=>v.files['main.py']+='\n# edit',(v:any)=>v.circuit.components[0].x++,(v:any)=>v.files['urs-vjezba.json']='answer']){const next=structuredClone(p);edit(next);assert.notEqual(await schoolFingerprint(next),before);}f.sync.stop();
});
test('unchanged opening does not upload and editing waits 3 seconds',async()=>{
  const f=await fixture();assert.equal(f.states.at(-1)?.phase,'saved');await f.advance(5000);assert.equal(f.calls.length,0);
  const next=editProject(f.p,p=>{p.files['main.py']+='\nprint(1)';});await f.sync.update(next);await f.advance(2999);assert.equal(f.calls.length,0);await f.advance(1);assert.equal(f.calls.length,1);assert.equal(f.states.at(-1)?.phase,'saved');assert.equal(f.confirmations.at(-1)?.revision,2);f.sync.stop();
});
test('continuous typing is saved at 15 seconds without waiting for a pause',async()=>{
  const f=await fixture();let p=f.p;
  for(let i=0;i<8;i++){p=editProject(p,v=>{v.files['main.py']+='\n# '+i;});await f.sync.update(p);if(i<7)await f.advance(2000);}
  assert.equal(f.calls.length,0);await f.advance(1000);assert.equal(f.calls.length,1);assert.match(f.calls[0].project.files['main.py'],/# 7/);f.sync.stop();
});
test('confirmation metadata does not produce an autosave feedback loop',async()=>{
  const f=await fixture();const p=editProject(f.p,v=>{v.files['main.py']='print(2)';});await f.sync.update(p);await f.sync.save();
  const marked=editProject(p,v=>{v.files['school-attempt.json']=JSON.stringify(f.confirmations.at(-1));});await f.sync.update(marked);await f.advance(20000);assert.equal(f.calls.length,1);f.sync.stop();
});
test('edits made during an in-flight request are saved in a later revision',async()=>{
  let finish:any;const calls:any[]=[];let first=true;
  const f=await fixture(async(_b:any,body:any)=>{calls.push(body);if(first){first=false;await new Promise(r=>finish=r);}return {attemptId:1,revision:body.expectedRevision+1,currentRevision:body.expectedRevision+1,savedAt:'now'};});
  await f.sync.update(editProject(f.p,p=>{p.files['main.py']='print(1)';}));const saving=f.sync.save();await f.flush();await f.sync.update(editProject(f.p,p=>{p.files['main.py']='print(2)';}));finish();await saving;await f.advance(3000);
  assert.equal(calls.length,2);assert.equal(calls[1].expectedRevision,2);assert.equal(calls[1].project.files['main.py'],'print(2)');f.sync.stop();
});
test('lost acknowledgement retries the exact payload and idempotency key before newer local changes',async()=>{
  const calls:any[]=[];let first=true;const f=await fixture(async(_b:any,body:any)=>{calls.push(structuredClone(body));if(first){first=false;throw Error('lost response');}return {attemptId:1,revision:body.expectedRevision+1,currentRevision:body.expectedRevision+1,savedAt:'now'};});
  await f.sync.update(editProject(f.p,p=>{p.files['main.py']='print(1)';}));await f.sync.save();assert.equal(f.states.at(-1)?.phase,'error');await f.sync.update(editProject(f.p,p=>{p.files['main.py']='print(2)';}));await f.sync.save();
  assert.deepEqual(calls[0],calls[1]);await f.advance(3000);assert.equal(calls[2].expectedRevision,2);assert.equal(calls[2].project.files['main.py'],'print(2)');f.sync.stop();
});
test('two stale editors block on conflict and do not adopt a newer revision without a review choice',async()=>{
  let calls=0;const f=await fixture(async()=>{++calls;throw new SchoolApiError('Sukob',409,'revision_conflict');});await f.sync.update(editProject(f.p,p=>{p.files['main.py']='print(2)';}));await f.sync.save();assert.equal(f.states.at(-1)?.phase,'conflict');await f.advance(30000);await f.sync.save();assert.equal(calls,1);assert.equal(f.confirmations.length,0);f.sync.stop();
});
test('an old retried acknowledgement reports a newer remote revision as conflict',async()=>{
  const f=await fixture(async()=>({attemptId:1,revision:2,currentRevision:3,savedAt:'now'}));await f.sync.update(editProject(f.p,p=>{p.files['main.py']='print(2)';}));await f.sync.save();assert.equal(f.states.at(-1)?.phase,'conflict');assert.equal(f.confirmations[0].revision,2);await f.advance(30000);f.sync.stop();
});
test('explicitly reviewed local choice uses the reviewed revision as its compare-and-swap base',async()=>{
  let fail=true;const calls:any[]=[];const f=await fixture(async(_b:any,body:any)=>{calls.push(body);if(fail){fail=false;throw new SchoolApiError('Sukob',409,'revision_conflict');}return {attemptId:1,revision:body.expectedRevision+1,currentRevision:body.expectedRevision+1,savedAt:'now'};});
  await f.sync.update(editProject(f.p,p=>{p.files['main.py']='print(2)';}));await f.sync.save();const remote={attempt:{id:1,revision:4},snapshot:{revision:4,project:source()}} as SchoolWorkState;
  await f.sync.useLocalAfterReview(remote);assert.equal(calls[1].expectedRevision,4);assert.notEqual(calls[1].requestKey,calls[0].requestKey);assert.equal(f.confirmations.at(-1)?.revision,5);f.sync.stop();
});
test('closing or changing projects never confirms a late response on the new workspace',async()=>{
  let finish:any;const f=await fixture(async()=>{await new Promise(r=>finish=r);return {attemptId:1,revision:2,currentRevision:2,savedAt:'now'};});await f.sync.update(editProject(f.p,p=>{p.files['main.py']='print(2)';}));const saving=f.sync.save();await f.flush();f.sync.stop();finish();await saving;assert.equal(f.confirmations.length,0);assert.equal(f.timers.size,0);
});
test('account switch is detected before sending another pupil’s project',async()=>{
  const calls:any[]=[];const api=new SchoolApi(async(url,init)=>{calls.push({url,init});return new Response(JSON.stringify({application:'labosv2',csrfToken:'token',user:{id:99,mustChangePassword:false}}),{status:200,headers:{'Content-Type':'application/json'}});});
  const f=await fixture();await assert.rejects(()=>api.save(readSchoolBinding(f.p)!,{}),/računom učenika/);assert.equal(calls.length,1);assert.match(String(calls[0].url),/action=session/);assert.equal(calls[0].init.cache,'no-store');f.sync.stop();
});
test('detached teacher/test copies preserve the snapshot and cannot autosave to an attempt',async()=>{
  const f=await fixture(),copy=detachedSchoolProject(f.p);assert.equal(readSchoolBinding(copy),undefined);assert.notEqual(copy.id,f.p.id);assert.deepEqual(copy.circuit,f.p.circuit);assert(!Object.hasOwn(schoolSnapshot(f.p,readSchoolBinding(f.p)!).files,'school-attempt.json'));f.sync.stop();
});

test('malformed imported sync metadata is ignored, including invalid saved timestamps',async()=>{
  const f=await fixture(),binding=readSchoolBinding(f.p)!;
  for(const patch of [{savedAt:'not-a-date'},{userId:-1},{revision:0},{fingerprint:'x'},{origin:42}]){const p=structuredClone(f.p);p.files['school-attempt.json']=JSON.stringify({...binding,...patch});assert.equal(readSchoolBinding(p),undefined);}f.sync.stop();
});

test('23F finish flush joins an in-flight autosave and confirms the final newer edit',async()=>{
  let finish:any;const calls:any[]=[];
  const f=await fixture(async(_b:any,body:any)=>{calls.push(body);if(calls.length===1)await new Promise(r=>finish=r);return {attemptId:1,revision:body.expectedRevision+1,currentRevision:body.expectedRevision+1,savedAt:'now'};});
  await f.sync.update(editProject(f.p,p=>{p.files['main.py']='print(1)';}));const saving=f.sync.save();await f.flush();
  const final=editProject(f.p,p=>{p.files['main.py']='print(2)';});const flushed=f.sync.flush(final);await f.flush();finish();await saving;const binding=await flushed;
  assert.equal(binding.revision,3);assert.equal(calls.length,2);assert.equal(calls[1].project.files['main.py'],'print(2)');assert.equal(f.states.at(-1)?.phase,'saved');assert.equal(f.timers.size,0);f.sync.stop();
});
test('23F finish flush rejects a missing acknowledgement and retries the same save before proceeding',async()=>{
  const calls:any[]=[];const f=await fixture(async(_b:any,body:any)=>{calls.push(body);if(calls.length===1)throw Error('offline');return {attemptId:1,revision:2,currentRevision:2,savedAt:'now'};});
  const final=editProject(f.p,p=>{p.files['main.py']='print(3)';});await assert.rejects(()=>f.sync.flush(final),/Nije spremljeno/);
  const binding=await f.sync.flush(final);assert.equal(binding.revision,2);assert.deepEqual(calls[0],calls[1]);f.sync.stop();
});
