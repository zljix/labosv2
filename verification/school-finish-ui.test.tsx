import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {setTimeout as delay} from 'node:timers/promises';
import {SchoolApi,prepareSchoolAttempt,readSchoolBinding,type SchoolWorkState} from '../src/platform/schoolSync';
import SchoolFinish from '../src/platform/SchoolFinish';

test('23F React final summary: save failure blocks finish; lost confirmation repeats the same request',{timeout:15000},async t=>{
  const dom=new JSDOM('<!doctype html><div id="test"></div>',{url:'https://school.test/',pretendToBeVisual:true});
  const prior={window:globalThis.window,document:globalThis.document,location:globalThis.location,IS_REACT_ACT_ENVIRONMENT:(globalThis as any).IS_REACT_ACT_ENVIRONMENT};
  Object.assign(globalThis,{window:dom.window,document:dom.window.document,location:dom.window.location,IS_REACT_ACT_ENVIRONMENT:true});
  const project=JSON.parse(readFileSync('.build/school-catalog/gpio-button-micropython.json','utf8'));
  const work:SchoolWorkState={attempt:{id:1,assignmentId:2,studentId:3,number:1,status:'in_progress',revision:2,savedAt:'2026-11-15T12:00:00Z'},student:{id:3,username:'student',displayName:'Učenik <img src=x>'},
    assignment:{id:2,className:'4.f',task:{version:1,definition:{code:'URS01'}}},snapshot:{revision:2,project,contentHash:'b'.repeat(64),savedAt:'2026-11-15T12:00:00Z',grading:{status:'evaluated',points:3,maxPoints:10,report:{criteria:[{id:'c',description:'Ponašanje',points:0,maxPoints:7,explanation:'Provjeri otpuštanje.'}]}}}};
  const local=await prepareSchoolAttempt(work),binding=readSchoolBinding(local)!;
  let offline=true,flushed=false,lost=true;const finished:unknown[]=[],locked:SchoolWorkState[]=[];
  const api=new SchoolApi(async(input,init)=>{
    const action=new URL(String(input),'https://school.test').searchParams.get('action');
    const response=(v:any)=>new Response(JSON.stringify({application:'labosv2',csrfToken:'csrf',...v}),{status:200});
    if(action==='session')return response({user:{id:3,mustChangePassword:false}});
    if(action==='attempt'){assert(flushed);return response(work);}
    if(action==='finish-attempt'){
      finished.push(JSON.parse(String(init?.body)));assert(flushed);
      if(lost){lost=false;throw Error('Izgubljen odgovor.');}
      return response({...work,attempt:{...work.attempt,status:'locked'},submission:{id:9,attemptId:1,revision:2,contentHash:'b'.repeat(64),submittedAt:'2026-11-15T12:01:00Z'}});
    }throw Error('Unexpected '+action);
  });
  const root=createRoot(document.querySelector('#test')!);t.after(async()=>{await act(async()=>root.unmount());Object.assign(globalThis,prior);dom.window.close();});
  await act(async()=>root.render(<SchoolFinish binding={binding} api={api} project={()=>local} enabled flush={async()=>{if(offline)throw Error('Spremanje nije potvrđeno.');flushed=true;return binding;}} locked={s=>locked.push(s)}/>));
  const text=()=>document.body.textContent??'';
  async function click(label:string){const b=[...document.querySelectorAll('button')].find(v=>v.textContent?.includes(label));assert(b,label);assert(!b.disabled,label);await act(async()=>{b.click();await delay(15);});for(let i=0;i<200&&document.querySelector("dialog button:disabled");i++)await act(async()=>{await delay(10);});}
  await click('Završi i zaključaj');assert.match(text(),/Spremanje nije potvrđeno/);assert.equal(finished.length,0);assert.equal(locked.length,0);
  offline=false;await click('Ponovi spremanje');assert.match(text(),/Neostvareni kriteriji/);assert.match(text(),/3 \/ 10/);assert.match(text(),/reviziju 2/);assert.equal(document.querySelector('img'),null);
  const original=local.files['main.py'];local.files['main.py']+='\n# edit after summary';await click('Potvrdi i zaključaj');assert.equal(finished.length,0);assert.match(text(),/nove lokalne izmjene/);local.files['main.py']=original;
  await click('Potvrdi i zaključaj');assert.equal(finished.length,1);assert.equal(locked.length,0);assert.match(text(),/još nije potvrđen/);
  await click('Potvrdi i zaključaj');assert.equal(finished.length,2);assert.deepEqual(finished[0],finished[1]);assert.equal(locked.length,1);assert.equal(locked[0].submission?.id,9);assert.equal(document.querySelector('dialog'),null);
});
