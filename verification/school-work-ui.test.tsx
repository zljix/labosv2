import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {JSDOM} from 'jsdom';
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {schoolFixture} from './school-http-fixture.mjs';
import {SchoolApi,prepareSchoolAttempt,readSchoolBinding,type SchoolBinding} from '../src/platform/schoolSync';
import SchoolWork from '../src/platform/SchoolWork';
import SchoolClassReview from '../src/platform/SchoolClassReview';
import {editProject,type Project} from '../src/project/model';

test('23D actual React UI with PHP/MySQL: save, offline recovery, conflict and teacher snapshot',{timeout:120000},async t=>{
  const f=await schoolFixture(t),teacher=await f.make('ui.teacher','teacher'),pupil=await f.make('ui.pupil','student','Učenik <img src=x>'),idle=await f.make('ui.idle');
  const c=(await teacher.client.call('create-class',{name:'4.f UI',schoolYear:'2026/2027'})).json.class;
  const csv='username;displayName\n'+[pupil,idle].map(s=>s.user.username+';'+s.user.displayName).join('\n');const plan=(await teacher.client.call('preview-students',{classId:c.id,csv})).json;assert.equal((await teacher.client.call('import-students',{classId:c.id,csv,previewToken:plan.previewToken,linkExisting:true})).status,200);
  const task=(await teacher.client.call('publish-task',{taskKey:'gpio/button'})).json.task;
  const assignment=(await teacher.client.call('create-assignment',{classId:c.id,taskVersionId:task.id,target:'micropython'})).json.assignment;
  const dom=new JSDOM('<!doctype html><div id="test"></div>',{url:f.origin+'/?schoolReview='+c.id+'&schoolExercise='+assignment.id,pretendToBeVisual:true});
  const prior={window:globalThis.window,document:globalThis.document,location:globalThis.location,fetch:globalThis.fetch,IS_REACT_ACT_ENVIRONMENT:(globalThis as any).IS_REACT_ACT_ENVIRONMENT};
  Object.assign(globalThis,{window:dom.window,document:dom.window.document,location:dom.window.location,IS_REACT_ACT_ENVIRONMENT:true});
  let cookie='',offline=false;const realFetch=prior.fetch;
  globalThis.fetch=async(input:any,init:any={})=>{
    if(offline&&String(input).includes('action=save-work'))throw Error('Nema veze. Izmjene su samo lokalne.');
    const headers=new Headers(init.headers);headers.set('Cookie',cookie);if(init.method==='POST')headers.set('Origin',f.origin);
    const response=await realFetch(new URL(String(input),f.origin),{...init,headers});const cookies=response.headers.getSetCookie();if(cookies.length)cookie=cookies.at(-1)!.split(';')[0];return response;
  };
  const root=createRoot(document.querySelector('#test')!);t.after(async()=>{await act(async()=>root.unmount());Object.assign(globalThis,prior);dom.window.close();});
  const api=new SchoolApi();await api.request('session');await api.request('login',{username:'ui.pupil',password:f.password});
  let project=await prepareSchoolAttempt(await api.request('begin-attempt',{assignmentId:assignment.id}));const attemptId=readSchoolBinding(project)!.attemptId;
  const opened:Project[]=[];
  async function render(){await act(async()=>root.render(<SchoolWork key={project.id} project={project} confirm={(binding:SchoolBinding)=>{project=editProject(project,p=>{p.files['school-attempt.json']=JSON.stringify(binding);});root.render(<SchoolWork key={project.id} project={project} confirm={confirm} open={open}/>);}} open={open}/>));}
  function confirm(binding:SchoolBinding){project=editProject(project,p=>{p.files['school-attempt.json']=JSON.stringify(binding);});root.render(<SchoolWork key={project.id} project={project} confirm={confirm} open={open}/>);}
  async function open(next:Project){opened.push(next);}
  async function until(check:()=>boolean,label:string){for(let i=0;i<200;i++){let done=false;await act(async()=>{await delay(25);done=check();});if(done)return;}assert.fail(label+'; '+document.body.textContent?.slice(0,1000));}
  async function click(text:string){const button=[...document.querySelectorAll('button')].find(b=>b.textContent?.includes(text));assert(button,text);assert(!button.disabled,text+' enabled');await act(async()=>button.click());}
  const text=()=>document.body.textContent??'';
  await render();await until(()=>text().includes('Spremljeno na školskom poslužitelju'),'session verified');
  await t.test('pupil edits are confirmed by the API and displayed as the exact revision',async()=>{
    project=editProject(project,p=>{p.files['main.py']='print("UI <img src=x>")';});await render();await until(()=>text().includes('Izmjene su lokalne'),'dirty');await click('Spremi sada');await until(()=>text().includes('revizija: 2'),'confirmed revision');
    assert.equal((await api.request('attempt&id='+attemptId)).snapshot.project.files['main.py'],'print("UI <img src=x>")');assert.equal(document.querySelector('img'),null);
  });
  await t.test('offline UI never claims a new revision is saved and retries without losing edits',async()=>{
    offline=true;project=editProject(project,p=>{p.files['main.py']='print("offline edit")';});await render();await until(()=>text().includes('Izmjene su lokalne'),'offline dirty');await click('Spremi sada');await until(()=>text().includes('Nije spremljeno na školskom poslužitelju'),'offline visible');assert(text().includes('revizija: 2'));
    assert.equal((await api.request('attempt&id='+attemptId)).snapshot.revision,2);offline=false;await click('Spremi sada');await until(()=>text().includes('revizija: 3'),'reconnected save');
  });
  await t.test('two devices show both source versions before an explicit conflict resolution',async()=>{
    const other=f.client();await other.login('ui.pupil',f.password);const latest=(await other.call('attempt&id='+attemptId)).json;
    latest.snapshot.project.files['main.py']='print("drugi uređaj")';assert.equal((await other.call('save-work',{attemptId,expectedRevision:3,requestKey:randomUUID(),project:latest.snapshot.project})).status,200);
    project=editProject(project,p=>{p.files['main.py']='print("moja odabrana verzija")';});await render();await until(()=>text().includes('Izmjene su lokalne'),'dirty conflict');await click('Spremi sada');await until(()=>text().includes('postoji novija revizija'),'conflict shown');
    await click('Pregledaj poslužiteljsku');await until(()=>text().includes('Usporedi lokalni rad'),'comparison');assert(text().includes('drugi uređaj'));assert(text().includes('moja odabrana verzija'));
    await click('Nakon pregleda spremi');await until(()=>text().includes('revizija: 5'),'reviewed revision saved');assert.equal((await api.request('attempt&id='+attemptId+'&revision=4')).snapshot.project.files['main.py'],'print("drugi uređaj")');
  });
  await t.test('finish saves the final dirty edit, shows the exact summary and opens an immutable receipt',async()=>{
    project=editProject(project,p=>{p.files['main.py']='print("moja završna predaja")';});await render();
    await click('Završi i zaključaj');await until(()=>text().includes('Zaključavaš reviziju 6'),'final save and summary');
    const saved=await api.request('attempt&id='+attemptId);assert.equal(saved.snapshot.revision,6);assert.equal(saved.snapshot.project.files['main.py'],'print("moja završna predaja")');
    await click('Potvrdi i zaključaj');await until(()=>text().includes('Vježba je zaključana'),'confirmed receipt');
    assert.equal((await api.request('attempt&id='+attemptId)).attempt.status,'locked');assert(text().includes('Sadržaj zaključane predaje'));
    assert.equal([...document.querySelectorAll('button')].find(b=>b.textContent?.includes('Završi i zaključaj')),undefined);
  });
  await t.test('teacher sees live and not-started work, inspects text safely and opens only a detached copy',async()=>{
    await act(async()=>root.render(<p>Promjena prikaza</p>));await api.request('logout',{});await api.request('session');await api.request('login',{username:'ui.teacher',password:f.password});
    await act(async()=>root.render(<SchoolClassReview open={open}/>));await until(()=>text().includes('Nije započeto')&&text().includes('Pregled osvježen'),'teacher roster');assert(text().includes('Učenik <img src=x>'));assert.equal(document.querySelector('img'),null);assert(!text().includes('0/'));
    await click('Pregledaj snimku');await until(()=>text().includes('revizija 6'),'teacher snapshot');assert(text().includes('moja završna predaja'));await click('Otvori zasebnu kopiju');await until(()=>opened.length===1,'copy opened');assert.equal(readSchoolBinding(opened[0]),undefined);assert.equal((await api.request('attempt&id='+attemptId)).snapshot.revision,6);
    const reason=document.querySelector('.school-reopen textarea') as HTMLTextAreaElement;assert(reason);
    await act(async()=>{reason.value='Doplni obrazloženje <img src=x>.';reason.dispatchEvent(new dom.window.Event('input',{bubbles:true}));});
    await click('Dopusti doradu');await until(()=>text().includes('Dopušten je pokušaj 2'),'teacher rework confirmation');assert.equal(document.querySelector('img'),null);
    await click('Povijest pokušaja / osvježi');await until(()=>text().includes('Pregledaj pokušaj 2'),'linked attempts visible');
    const history=await api.request('attempt-history&id='+attemptId);assert.equal(history.attempts.length,2);assert.equal(history.attempts[1].attempt.status,'locked');assert.equal(history.attempts[0].reopening.previousAttemptId,attemptId);
    await act(async()=>{const session=new SchoolApi();await session.request('session');await session.request('logout',{});});await until(()=>!text().includes('Učenik <img src=x>'),'expired session clears private roster');
  });
  await t.test('pupil opens the permitted new attempt while the previous locked project remains unchanged',async()=>{
    await api.request('session');await api.request('login',{username:'ui.pupil',password:f.password});
    const next=await api.request('begin-attempt',{assignmentId:assignment.id});assert.equal(next.attempt.number,2);assert.notEqual(next.attempt.id,attemptId);
    project=await prepareSchoolAttempt(next);await render();await until(()=>text().includes('Spremljeno na školskom poslužitelju'),'rework ready');
    assert(text().includes('Dorada pokušaja 2'));assert.equal(project.files['main.py'],'print("moja završna predaja")');
    assert.equal((await api.request('attempt&id='+attemptId)).snapshot.revision,6);assert.equal((await api.request('attempt&id='+attemptId)).attempt.status,'locked');
  });
});
