import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {JSDOM} from 'jsdom';
import {schoolFixture} from './school-http-fixture.mjs';

test('23C actual portal modules: teacher preparation, pupil first login and admission approval',{timeout:120000},async t=>{
  const f=await schoolFixture(t),teacher=await f.make('portal.teacher','teacher','Nastavnik Portala');
  const dom=new JSDOM(readFileSync(join(f.pkg,'web/school.html'),'utf8'),{url:f.origin+'/school.html'});
  const saved={document:globalThis.document,window:globalThis.window,FormData:globalThis.FormData,fetch:globalThis.fetch};
  globalThis.document=dom.window.document;globalThis.window=dom.window;globalThis.FormData=dom.window.FormData;
  let cookie='';const originalFetch=saved.fetch;
  globalThis.fetch=async(input,init={})=>{
    const url=new URL(String(input),f.origin+'/school.html'),headers=new Headers(init.headers),explicitCookie=headers.has('Cookie');
    if(!explicitCookie)headers.set('Cookie',cookie);
    if(init.method==='POST')headers.set('Origin',f.origin);
    const response=await originalFetch(url,{...init,headers});const set=response.headers.getSetCookie();if(set.length&&!explicitCookie)cookie=set.at(-1).split(';')[0];return response;
  };
  t.after(()=>{Object.assign(globalThis,saved);dom.window.close();});
  const $=s=>document.querySelector(s);
  async function until(check,label){for(let i=0;i<200;i++){if(check())return;await delay(25);}assert.fail(label+'; message: '+$('#account-message').textContent);}
  function fill(form,fields){for(const [name,value] of Object.entries(fields)){const input=form.querySelector('[name="'+name+'"]');assert(input,name);input.value=value;}}
  async function submit(id,fields,expected){const form=$(id);fill(form,fields);form.dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));await until(()=>$('#account-message').textContent.includes(expected),'submit '+id);await until(()=>!$('#logout').disabled,'controls restored');}
  async function click(id,expected){$(id).click();await until(()=>$('#account-message').textContent.includes(expected),'click '+id);await until(()=>!$('#logout').disabled,'controls restored');}
  await import('../public/school-account.mjs');
  await until(()=>!$('#account-controls').hidden,'portal ready');

  await t.test('teacher creates class and imports pupils through preview and confirmation',async()=>{
    await submit('#login-form',{username:'portal.teacher',password:f.password},'Prijavljen/a');
    await submit('#create-class-form',{name:'4.f portal',schoolYear:'2026/2027'},'Razred je stvoren');
    assert.match($('#class-heading').textContent,/4.f portal/);
    $('#csv-text').value='username;displayName;temporaryPassword\nportal.pupil;Učenik Portala;'+f.temporary;
    await submit('#csv-form',{},'Pregled uvoza je spreman');assert(!$('#csv-preview').textContent.includes(f.temporary));assert(!$('#csv-commit').hidden);
    $('#csv-text').dispatchEvent(new dom.window.Event('input'));assert($('#csv-commit').hidden);
    await submit('#csv-form',{},'Pregled uvoza je spreman');await click('#import-csv','Uvoz završen');
    assert.match($('#class-students').textContent,/Učenik Portala/);assert.equal($('#csv-text').value,'');
  });
  await t.test('teacher publishes an immutable rubric and assigns the correct target',async()=>{
    await submit('#publish-task-form',{taskKey:'gpio/button',teacherNotes:'Pregledaj <img src=x onerror=alert(1)> kao običan tekst.',criteria:'Spoj | 3\nPonašanje | 5\nPočetno stanje | 2'},'Objavljena je');
    assert.equal($('#published-task img'),null);assert.match($('#published-task').textContent,/najviše 10 bodova/);
    assert.equal($('#assignment-target').options.length,5);
    await submit('#assignment-form',{taskVersionId:$('#assignment-version').value,target:'micropython',dueAt:''},'Vježba je dodijeljena');
    assert.equal($('#school-assignments').querySelectorAll('article').length,1);assert.match($('#school-assignments a').href,/\?schoolAssignment=\d+/);
    await submit('#invite-form',{hours:'24',maxUses:'30'},'Novi kod prikazan');assert.match($('#invite-result').textContent,/^[A-F0-9]{24}$/);
  });
  const invite=$('#invite-result').textContent;
  await t.test('first-login password gate and pupil view show only assigned instructions and planned points',async()=>{
    await click('#logout','Odjavljen/a');assert($('#school-work').hidden);assert.equal($('#invite-result').textContent,'');
    await submit('#login-form',{username:'portal.pupil',password:f.temporary},'Sada postavi');assert($('#school-work').hidden);
    await submit('#password-form',{currentPassword:f.temporary,newPassword:f.password,repeatPassword:f.password},'Lozinka je promijenjena');
    assert(!$('#school-work').hidden);assert($('#school-staff').hidden);assert.match($('#student-classes').textContent,/4.f portal/);
    assert.equal($('#school-assignments').querySelectorAll('article').length,1);assert.match($('#school-assignments').textContent,/ovo nisu osvojeni bodovi/);
    assert.equal($('#school-assignments img'),null);
  });
  await t.test('registration form sends an admission request; refresh after teacher approval reveals assignments',async()=>{
    await click('#logout','Odjavljen/a');
    await submit('#register-form',{code:invite,displayName:'Učenik Kodom',username:'portal.joined',password:f.password,repeatPassword:f.password},'Učenički račun je stvoren');
    await submit('#login-form',{username:'portal.joined',password:f.password},'Prijavljen/a');
    assert.equal($('#school-assignments').querySelectorAll('article').length,0);assert.match($('#my-requests').textContent,/Čeka potvrdu/);
    const classes=(await teacher.client.call('classes')).json.classes,detail=(await teacher.client.call('class&id='+classes[0].id)).json.class;
    const result=await teacher.client.call('review-join',{requestId:detail.requests[0].id,approve:true});assert.equal(result.status,200,result.text);
    $('#refresh-school').click();await until(()=>$('#school-assignments').querySelectorAll('article').length===1,'approved class assignments');
    assert.match($('#my-requests').textContent,/potvrdio/);
  });
});
