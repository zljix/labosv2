import React from 'react';
import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import CircuitEditor from '../src/circuit/CircuitEditor';
import ActionGroup from '../src/app/ActionGroup';
import {emptyCircuit,makePart,type Circuit} from '../src/circuit/model';
import {tabKeys} from '../src/platform/tabs';
import {readFileSync} from 'node:fs';
import {sdCircuit} from '../src/circuit/sdExamples';
import {sdReadFile} from '../public/sd-card.mjs';

test('24Q circuit catalog, keyboard tabs, precise movement and action disclosure work without pointer dragging',async t=>{
 const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'https://lab.test/'});
 const names=['window','document','HTMLElement','SVGElement','IS_REACT_ACT_ENVIRONMENT'] as const;
 const prior=Object.fromEntries(names.map(k=>[k,(globalThis as any)[k]]));
 Object.assign(globalThis,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,SVGElement:dom.window.SVGElement,IS_REACT_ACT_ENVIRONMENT:true});
 const {createRoot}=await import('react-dom/client');
 const root=createRoot(document.getElementById('root')!);t.after(async()=>{await React.act(async()=>root.unmount());Object.assign(globalThis,prior);dom.window.close();});
 let saved:Circuit=emptyCircuit();saved.components.push(makePart('led',700,200,'test-led'));
 function Fixture(){const [c,setC]=React.useState(saved);return <><CircuitEditor circuit={c} onChange={next=>{saved=next;setC(next);}} onDemo={()=>{}} onUndo={()=>{}} onRedo={()=>{}} canUndo={false} canRedo={false} expanded={false} onExpand={()=>{}}/><ActionGroup title="Projekt"><button onClick={()=>{}}>Novi</button></ActionGroup></>;}
 await React.act(async()=>root.render(<Fixture/>));
 const catalog=document.querySelector<HTMLDetailsElement>('.component-library')!;
 assert.equal(catalog.open,false);
 const search=catalog.querySelector<HTMLInputElement>('input')!;
 const type=async(value:string)=>{await React.act(async()=>{Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value')!.set!.call(search,value);search.dispatchEvent(new dom.window.Event('input',{bubbles:true}));});};
 await type('does-not-exist');assert.match(catalog.textContent??'',/Nema komponente/);
 await type('OLED');assert(catalog.querySelectorAll('.component-catalog button').length>1);assert(!/Nema komponente/.test(catalog.textContent??''));
 await type('');
 // Adding a part reveals it without requiring the student to find it off-canvas.
 catalog.open=true;
 const count=saved.components.length;
 await React.act(async()=>{[...catalog.querySelectorAll<HTMLButtonElement>('.component-catalog button')].find(b=>b.textContent?.endsWith('LED'))!.click();});
 assert.equal(saved.components.length,count+1);assert.equal(catalog.open,false);
 assert.equal(document.activeElement,document.querySelector('.circuit-canvas svg'));
 const added=saved.components.at(-1)!;
 const [vx,vy,vw,vh]=document.querySelector('.circuit-canvas svg')!.getAttribute('viewBox')!.split(' ').map(Number);
 assert(added.x>=vx&&added.x<vx+vw&&added.y>=vy&&added.y<vy+vh);
 assert.match(document.querySelector('.circuit-hint')!.textContent!,/Dodano:/);
 assert.equal(document.querySelector<HTMLSelectElement>('[aria-label="Odaberi element"]')!.value,'part:'+added.id);
 catalog.open=true;
 await React.act(async()=>catalog.querySelector('input')!.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true})));
 assert.equal(catalog.open,false);assert.equal(document.activeElement,catalog.querySelector('summary'));
 const canvas=document.querySelector('.circuit-canvas')!,inputs=document.querySelector('.simulation-controls')!;
 assert(canvas.compareDocumentPosition(inputs)&dom.window.Node.DOCUMENT_POSITION_FOLLOWING);
 const tabs=[...document.querySelectorAll<HTMLButtonElement>('.circuit-tabs [role="tab"]')];
 assert.deepEqual(tabs.map(t=>t.tabIndex),[0,-1,-1,-1]);
 await React.act(async()=>{tabs[0].focus();tabs[0].dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'End',bubbles:true}));});
 assert.equal(document.activeElement,tabs[3]);assert.equal(tabs[3].getAttribute('aria-selected'),'true');
 assert.equal(document.querySelector('[role="tabpanel"]')?.getAttribute('aria-labelledby'),tabs[3].id);
 await React.act(async()=>{tabs[3].dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));});
 assert.equal(document.activeElement,tabs[0]);
 const picker=document.querySelector<HTMLSelectElement>('[aria-label="Odaberi element"]')!;
 await React.act(async()=>{picker.value='part:test-led';picker.dispatchEvent(new dom.window.Event('change',{bubbles:true}));});
 const geometry=document.querySelector<HTMLDetailsElement>('.part-properties .advanced-position')!;
 assert.equal(geometry.open,false);
 assert(geometry.querySelector('[aria-label="Zakretanje"]'));
 assert(!geometry.contains(document.querySelector('[aria-label="Boja LED"]')));
 const projectBeforeMessage=JSON.stringify(saved);
 const warning=document.querySelector<HTMLButtonElement>('.part-diagnostics button')!;
 assert.match(warning.textContent!,/nepriključeni izvodi/);
 await React.act(async()=>warning.click());
 assert.equal(JSON.stringify(saved),projectBeforeMessage);
 assert(document.querySelector('.terminal-properties'));
 assert.match(document.querySelector('.circuit-hint')!.textContent!,/nepriključeni izvodi/);
 await React.act(async()=>{picker.value='part:test-led';picker.dispatchEvent(new dom.window.Event('change',{bubbles:true}));});
 const x=document.querySelector<HTMLInputElement>('[aria-label="Položaj X komponente"]')!;
 await React.act(async()=>{x.value='740';x.dispatchEvent(new dom.window.FocusEvent('focusout',{bubbles:true}));});
 assert.equal(saved.components.find(p=>p.id==='test-led')?.x,740);
 const nextX=document.querySelector<HTMLInputElement>('[aria-label="Položaj X komponente"]')!;
 await React.act(async()=>{nextX.value='9900';nextX.dispatchEvent(new dom.window.FocusEvent('focusout',{bubbles:true}));});
 assert.equal(saved.components.find(p=>p.id==='test-led')?.x,740);assert.equal(nextX.value,'740');
 // Arrow-key panning does not modify the project geometry.
 const before=JSON.stringify(saved),svg=document.querySelector('.circuit-canvas svg')!,box=svg.getAttribute('viewBox');
 await React.act(async()=>svg.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true})));
 assert.notEqual(svg.getAttribute('viewBox'),box);assert.equal(JSON.stringify(saved),before);
 const disclosure=document.querySelector<HTMLDetailsElement>('.action-group')!;disclosure.open=true;
 await React.act(async()=>disclosure.querySelector('summary')!.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true})));
 assert.equal(disclosure.open,false);assert.equal(document.activeElement,disclosure.querySelector('summary'));
});

test('24Q tab keyboard helper ignores ordinary buttons and lets Tab leave the strip',()=>{
 let prevented=false;
 const e={currentTarget:{querySelectorAll:()=>[]},target:{},key:'Tab',preventDefault:()=>{prevented=true;}};
 tabKeys(e as any);assert.equal(prevented,false);
});

test('24Q saving SD and RTC in either order retains both stopped snapshots; an edit clears them',async t=>{
 const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'https://lab.test/'});
 const names=['window','document','HTMLElement','SVGElement','IS_REACT_ACT_ENVIRONMENT'] as const;
 const prior=Object.fromEntries(names.map(k=>[k,(globalThis as any)[k]]));
 Object.assign(globalThis,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,SVGElement:dom.window.SVGElement,IS_REACT_ACT_ENVIRONMENT:true});
 const {createRoot}=await import('react-dom/client');
 const root=createRoot(document.getElementById('root')!);t.after(async()=>{await React.act(async()=>root.unmount());Object.assign(globalThis,prior);dom.window.close();});
 const frame=JSON.parse(readFileSync('docs/stage19b-evidence/python-sdLogger.json','utf8')).frame;
 let saved:Circuit;
 function Fixture(){
  const [c,setC]=React.useState(()=>sdCircuit('sdLogger')),[simulation,setSimulation]=React.useState(frame);
  saved=c;
  return <CircuitEditor circuit={c} simulation={simulation} onChange={(next,_label,kind)=>{setC(next);if(kind!=='snapshot')setSimulation(undefined);}} onDemo={()=>{}} onUndo={()=>{}} onRedo={()=>{}} canUndo={false} canRedo={false} expanded={false} onExpand={()=>{}}/>;
 }
 const buttons=['Sačuvaj karticu u projekt','Sačuvaj snimku RTC-a'];
 const button=(name:string)=>[...document.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent===name)!;
 for(const order of [buttons,[...buttons].reverse()]){
  await React.act(async()=>root.render(<Fixture key={order[0]}/>));
  for(const name of order){assert.equal(button(name).disabled,false);await React.act(async()=>button(name).click());}
  assert.deepEqual(saved!.components.find(p=>p.kind==='microSD')!.properties.sdState,frame.sdCards.sd1.state);
  assert.match(new TextDecoder().decode(sdReadFile(saved!.components.find(p=>p.kind==='microSD')!.properties.sdState,'LOG.CSV')),/uzorak,vrijeme\n0,2026-01-01/);
  const rtc=saved!.components.find(p=>p.kind==='ds1302')!;
  assert.deepEqual(rtc.properties.rtcState,frame.rtcDevices[rtc.id].state);
  const picker=document.querySelector<HTMLSelectElement>('[aria-label="Odaberi element"]')!;
  await React.act(async()=>{picker.value='part:'+rtc.id;picker.dispatchEvent(new dom.window.Event('change',{bubbles:true}));});
  const x=document.querySelector<HTMLInputElement>('[aria-label="Položaj X komponente"]')!;
  await React.act(async()=>{x.value=String(rtc.x+10);x.dispatchEvent(new dom.window.FocusEvent('focusout',{bubbles:true}));});
  assert(button(buttons[0]).disabled);assert(button(buttons[1]).disabled);
 }
});
