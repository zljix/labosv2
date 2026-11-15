import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {setTimeout as delay} from 'node:timers/promises';
import SchoolGrading,{gradingLabel} from '../src/platform/SchoolGrading';
import type {SchoolBinding} from '../src/platform/schoolSync';

test('23E result labels preserve null rather than inventing zero',()=>{
  for(const status of ['queued','running','unsupported','technical_error','execution_limit','not_enabled'])assert(!gradingLabel({status,points:null}).includes('0 /'));
  assert.match(gradingLabel({status:'evaluated',points:0,maxPoints:10}),/0 \/ 10/);
});
test('23E actual React grading: polling, revision change, local edits, retry and account revocation',async t=>{
  const dom=new JSDOM('<!doctype html><div id="test"></div>',{url:'https://labos.test/',pretendToBeVisual:true});
  const prior={window:globalThis.window,document:globalThis.document,location:globalThis.location,fetch:globalThis.fetch,IS_REACT_ACT_ENVIRONMENT:(globalThis as any).IS_REACT_ACT_ENVIRONMENT};
  Object.assign(globalThis,{window:dom.window,document:dom.window.document,location:dom.window.location,IS_REACT_ACT_ENVIRONMENT:true});
  let status='queued',signedIn=true,requests=0,revision=1,saved=true;
  globalThis.fetch=async(input:any,init:any={})=>{
    const url=new URL(String(input),'https://labos.test'),action=url.searchParams.get('action');
    const json=(body:any,code=200)=>new Response(JSON.stringify({application:'labosv2',csrfToken:'csrf',...body}),{status:code});
    if(action==='session')return json({user:signedIn?{id:1,role:'student',mustChangePassword:false}:null});
    if(action==='request-grade'){requests++;const body=JSON.parse(init.body);assert.equal(body.expectedRevision,revision);return json({grading:{status:'queued',points:null,revision}});}
    if(action==='grading')return signedIn?json({grading:{status,points:status==='evaluated'?10:null,maxPoints:10,revision:Number(url.searchParams.get('revision')),
      ...(status==='evaluated'?{report:{message:'<img src=x onerror=alert(1)>',criteria:[{id:'x',description:'Kriterij <b>tekst</b>',points:10,maxPoints:10,explanation:'Potvrđeno.'}]}}:{})}}):json({error:{code:'authentication',message:'Prijavi se.'}},401);
    throw Error('Unexpected grading request '+action);
  };
  const binding:SchoolBinding={format:'labosv2-school-attempt',version:1,origin:'https://labos.test',userId:1,attemptId:1,assignmentId:1,projectId:'project-test',revision:1,fingerprint:'a'.repeat(64)};
  const root=createRoot(document.querySelector('#test')!);t.after(async()=>{await act(async()=>root.unmount());Object.assign(globalThis,prior);dom.window.close();});
  const text=()=>document.body.textContent??'';
  const render=async()=>{await act(async()=>{root.render(<SchoolGrading binding={binding} revision={revision} saved={saved}/>);await delay(5);});};
  const refresh=async()=>{await act(async()=>{document.dispatchEvent(new dom.window.Event('visibilitychange'));await delay(10);});};
  await render();assert.match(text(),/čeka provjeru/);assert(!text().includes('0 / 10'));
  status='evaluated';await refresh();assert.match(text(),/10 \/ 10 potvrđenih bodova/);assert.equal(document.querySelector('img'),null);assert.match(text(),/<img src=x/);
  saved=false;await render();assert.match(text(),/Lokalne izmjene još nemaju potvrđene bodove/);assert(document.querySelector('button')!.disabled);
  saved=true;revision=2;status='technical_error';await render();assert(!text().includes('10 / 10'));assert.match(text(),/Tehnička pogreška/);
  await act(async()=>{document.querySelector('button')!.click();await delay(10);});assert.equal(requests,1);assert.match(text(),/čeka provjeru/);
  signedIn=false;await refresh();assert(!text().includes('10 / 10'));assert.match(text(),/Prijavi se/);
});
