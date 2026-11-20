import React from 'react';
import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {readFileSync} from 'node:fs';
import {ArduinoBuildPanel} from '../src/runtime/ArduinoPanel';
import {arduinoExampleProject} from '../src/runtime/arduinoExamples';
import {UNO} from '../src/boards/profiles';
import {clearBuildCache} from '../src/runtime/arduinoBuild';

test('25A rendered compiler: school selection, stale result rejection and clickable error line',async t=>{
 const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'https://school.test/'});
 const names=['window','document','HTMLElement','localStorage','IS_REACT_ACT_ENVIRONMENT'];
 const prior=Object.fromEntries(names.map(k=>[k,(globalThis as any)[k]]));Object.assign(globalThis,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,localStorage:dom.window.localStorage,IS_REACT_ACT_ENVIRONMENT:true});
 const {createRoot}=await import('react-dom/client'),root=createRoot(document.getElementById('root')!);
 t.after(async()=>{await React.act(async()=>root.unmount());Object.assign(globalThis,prior);dom.window.close();});
 let resolveCompile:(v:any)=>void=()=>{},imported=0,calls=0,revealed:any;
 const artifact=JSON.parse(readFileSync('public/avr-examples.json','utf8'))[UNO].blink;
 const compiler:any={mode:'school',setMode:()=>{},capabilities:{targets:{[UNO]:{ready:true}}},schoolStatus:'Prevođenje',refreshSchool:async()=>{},connection:'disconnected',message:'',connect:()=>{},disconnect:()=>{},cancel:()=>{},compile:async()=>{calls++;return new Promise(r=>resolveCompile=r);}};
 let p=arduinoExampleProject('blink',UNO);delete p.files['avr-build.json'];clearBuildCache();
 const render=async()=>React.act(async()=>root.render(<ArduinoBuildPanel project={p} compiler={compiler} consoleText="" importBuild={()=>{imported++;}} setLibraries={()=>{}} goTo={d=>revealed=d}/>));
 const click=async(text:string)=>React.act(async()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent===text);assert(b,text);b.click();});
 await render();assert.match(document.body.textContent??'',/Školski prevoditelj za ovu pločicu je spreman/);
 await click('Prevedi program');for(let i=0;i<30&&!calls;i++)await React.act(async()=>{await new Promise(r=>setTimeout(r,5));});assert.equal(calls,1);
 p=structuredClone(p);p.files['main.ino']+='\n// changed while compiling';await render();
 await React.act(async()=>{resolveCompile({artifact,cached:false});await new Promise(r=>setTimeout(r,30));});assert.equal(imported,0);assert.match(document.body.textContent??'',/promijenjeni su tijekom prevođenja/);
 compiler.compile=async()=>{throw Object.assign(Error('bad source'),{diagnostics:[{file:'main.ino',line:2,column:3,severity:'error',message:'expected ;'}]});};
 await render();await click('Prevedi program');await React.act(async()=>{await new Promise(r=>setTimeout(r,30));});await click('main.ino:2:3');assert.equal(revealed.line,2);assert.equal(revealed.column,3);
});

test('offline library selection errors remain visible with the standard compiler collapsed',async t=>{
 const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'https://prototype.test/'});
 const names=['window','document','HTMLElement','localStorage','IS_REACT_ACT_ENVIRONMENT'];
 const prior=Object.fromEntries(names.map(k=>[k,(globalThis as any)[k]]));Object.assign(globalThis,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,localStorage:dom.window.localStorage,IS_REACT_ACT_ENVIRONMENT:true});
 const {createRoot}=await import('react-dom/client'),root=createRoot(document.getElementById('root')!);
 t.after(async()=>{await React.act(async()=>root.unmount());Object.assign(globalThis,prior);dom.window.close();});
 const compiler:any={mode:'school',setMode:()=>{},capabilities:{targets:{}},refreshSchool:async()=>{},connection:'disconnected',message:'',cancel:()=>{}};
 const project=arduinoExampleProject('blink',UNO);let changes=0;
 await React.act(async()=>root.render(<ArduinoBuildPanel offline project={project} compiler={compiler} consoleText="" importBuild={()=>{}} setLibraries={()=>{changes++;}} goTo={()=>{}}/>));
 await React.act(async()=>{const label=[...document.querySelectorAll('.library-picker label')].find(l=>l.textContent?.includes('DallasTemperature'));assert(label);(label.querySelector('input') as HTMLInputElement).click();});
 const alert=document.querySelector('.library-picker [role="alert"]');assert(alert);assert.match(alert.textContent??'',/OneWire/);
 assert.equal((alert.closest('details') as HTMLDetailsElement).open,true);assert.equal(changes,0);
 assert.equal((document.querySelector('.arduino-build > details') as HTMLDetailsElement).open,false);
 assert.match(document.querySelector('.library-picker')?.textContent??'',/podmape još nisu podržane/);
});
