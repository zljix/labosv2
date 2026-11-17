import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';

test('24P real Unicode input keeps an overlong draft visible and blocks submission until corrected',async t=>{
  const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'https://school.test/'});
  const prior={window:globalThis.window,document:globalThis.document,HTMLElement:globalThis.HTMLElement,IS_REACT_ACT_ENVIRONMENT:(globalThis as any).IS_REACT_ACT_ENVIRONMENT};
  Object.assign(globalThis,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true});
  const React=await import('react'),{createRoot}=await import('react-dom/client'),{default:IdentityInput}=await import('../src/platform/IdentityInput');
  let saved='Početno';
  function Worksheet(){const [value,setValue]=React.useState(saved),[valid,setValid]=React.useState(true);return <><IdentityInput value={value} limit={120} onValidityChange={setValid} onChange={v=>{saved=v;setValue(v);}}/><button disabled={!valid}>Predaj</button></>;}
  const root=createRoot(document.querySelector('#root')!);t.after(async()=>{await React.act(async()=>root.unmount());Object.assign(globalThis,prior);dom.window.close();});
  await React.act(async()=>root.render(<Worksheet/>));
  const input=document.querySelector('input')!,button=document.querySelector('button')!;
  const type=async(value:string)=>{await React.act(async()=>{Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value')!.set!.call(input,value);input.dispatchEvent(new dom.window.Event('input',{bubbles:true}));});};
  await type('😀'.repeat(120));assert.equal(saved,'😀'.repeat(120));assert.equal(button.disabled,false);
  await type('😀'.repeat(121));assert.equal(input.value,'😀'.repeat(121));assert.equal(saved,'😀'.repeat(120));assert.equal(button.disabled,true);assert.equal(input.checkValidity(),false);assert.match(document.body.textContent??'',/do 120 znakova/);
  await type('Ž'.repeat(120));assert.equal(saved,'Ž'.repeat(120));assert.equal(button.disabled,false);assert.equal(input.checkValidity(),true);
});
