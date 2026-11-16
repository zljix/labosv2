import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {setTimeout as delay} from 'node:timers/promises';
import SchoolReports from '../src/platform/SchoolReportsView';
import SchoolFeedback from '../src/platform/SchoolFeedback';
import {gradingLabel} from '../src/platform/SchoolGrading';

test('23H actual report and feedback components: scoped load, null/zero, safe text, conflict and revoked access',async t=>{
  const dom=new JSDOM('<!doctype html><div id="test"></div>',{url:'https://labos.test/',pretendToBeVisual:true});
  const prior={window:globalThis.window,document:globalThis.document,location:globalThis.location,fetch:globalThis.fetch,IS_REACT_ACT_ENVIRONMENT:(globalThis as any).IS_REACT_ACT_ENVIRONMENT};
  Object.assign(globalThis,{window:dom.window,document:dom.window.document,location:dom.window.location,IS_REACT_ACT_ENVIRONMENT:true});
  let denied=false;
  globalThis.fetch=async(input:any,init:any={})=>{
    const url=new URL(String(input),'https://labos.test'),action=url.searchParams.get('action');
    const json=(body:any,status=200)=>new Response(JSON.stringify({application:'labosv2',csrfToken:'token',...body}),{status});
    if(action==='session')return json({user:{id:2,role:'teacher',mustChangePassword:false}});
    if(denied)return json({error:{code:'forbidden',message:'Pristup više nije dostupan.'}},403);
    if(action==='class')return json({class:{students:[{id:1,username:'a',displayName:'A'}]}});
    if(action==='achievements'){
      assert.equal(url.searchParams.get('classId'),'4');
      return json({class:{name:'4.f',schoolYear:'2026/2027'},rows:[{student:{id:1,displayName:'<img src=x>',username:'a'},assignment:{id:7,code:'URS01',title:'Tipkalo',target:'micropython'},status:'not_started',assessment:{points:null,maxPoints:10,source:'pending'}}],hasMore:false,serverTime:'2026-11-15T15:00:00Z'});
    }
    if(action==='work-feedback')return json({reviews:[{id:1,action:'comment',reason:'<img src=x>',author:{displayName:'Nastavnik'},createdAt:'2026-11-15T15:00:00Z'}],latestReviewId:1,hasMore:false});
    if(action==='review-work'){const body=JSON.parse(init.body);assert.equal(body.expectedReviewId,1);assert.equal(body.revision,3);return json({error:{code:'review_conflict',message:'Drugi je nastavnik dopunio pregled.'}},409);}
    throw Error('Unexpected '+action);
  };
  const root=createRoot(document.querySelector('#test')!);t.after(async()=>{await act(async()=>root.unmount());Object.assign(globalThis,prior);dom.window.close();});
  const text=()=>document.body.textContent??'';
  const click=async(label:string)=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent?.includes(label));assert(b,label);await act(async()=>{b.click();await delay(5);});};
  await act(async()=>{root.render(<SchoolReports classId="4" assignments={[]} user={{id:2,role:'teacher'}} inspect={async()=>{}}/>);await delay(5);});
  await click('Prikaži / osvježi');assert.match(text(),/Nije započeto/);assert(!text().includes('0 / 10'));assert(text().includes('<img src=x>'));assert.equal(document.querySelector('img'),null);
  denied=true;await click('Prikaži / osvježi');assert(!text().includes('<img src=x>'));assert.match(text(),/Pristup više/);denied=false;
  await act(async()=>root.render(<SchoolFeedback attemptId={9} revision={3} staff/>));await click('Komentari i povijest');assert(text().includes('<img src=x>'));assert.equal(document.querySelector('img'),null);
  await act(async()=>{const textarea=document.querySelector('textarea')!;Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype,'value')!.set!.call(textarea,'Novi komentar');textarea.dispatchEvent(new dom.window.Event('input',{bubbles:true}));textarea.dispatchEvent(new dom.window.Event('change',{bubbles:true}));});
  await act(async()=>{document.querySelector('form')!.dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));await delay(5);});
  assert.match(text(),/Drugi je nastavnik dopunio pregled/);
  assert.match(gradingLabel({points:10,maxPoints:10,teacherReview:{action:'correct',points:0,maxPoints:10}}),/0 \/ 10.*korekcija/);
  denied=true;await click('Komentari i povijest');assert(!text().includes('<img src=x>'));assert.match(text(),/Pristup više/);
});
