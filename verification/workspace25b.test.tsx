import React,{act} from 'react';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setTimeout as delay} from 'node:timers/promises';
import {JSDOM} from 'jsdom';
import {UrsCatalog} from '../src/lessons/UrsPanel';
import SchoolWork from '../src/platform/SchoolWork';
import {prepareSchoolAttempt,type SchoolWorkState} from '../src/platform/schoolSync';
import {ProjectFiles,FileTabs,fileTabId} from '../src/app/ProjectFiles';

async function environment(t:any){
 const dom=new JSDOM('<div id="root"></div>',{url:'https://school.test/',pretendToBeVisual:true});
 const prior={window:globalThis.window,document:globalThis.document,location:globalThis.location,fetch:globalThis.fetch,IS_REACT_ACT_ENVIRONMENT:(globalThis as any).IS_REACT_ACT_ENVIRONMENT};
 Object.assign(globalThis,{window:dom.window,document:dom.window.document,location:dom.window.location,IS_REACT_ACT_ENVIRONMENT:true});
 const {createRoot}=await import('react-dom/client');
 const root=createRoot(document.getElementById('root')!);
 t.after(async()=>{await act(async()=>root.unmount());Object.assign(globalThis,prior);dom.window.close();});
 return {root,dom};
}
test('25H file search includes auxiliary records and preserves files while tabs close, reopen and follow renames',async t=>{
 const {root,dom}=await environment(t);
 const files={'main.py':'print("sačuvano")','lib/pomoc.py':'# odgovor učenika','urs-work.json':'{"answer":"opažanje"}','BILJESKE.TXT':'upute'};
 const original=JSON.stringify(files);let setFiles:any,selectActive:any;
 function Fixture({id}:{id:string}) {
  const [active,setActive]=React.useState('main.py');selectActive=setActive;
  const [current,update]=React.useState(files);setFiles=update;
  return <><ProjectFiles key={'list-'+id} files={current} active={active} entryFile="main.py" onSelect={setActive}/>
   <FileTabs key={'tabs-'+id} files={current} active={active} onSelect={setActive} onCreate={()=>{}}/>
   <div id="file-content" role="tabpanel" aria-labelledby={fileTabId(active)}>{current[active as keyof typeof current]}</div></>;
 }
 await act(async()=>root.render(<Fixture id="first"/>));
 const search=()=>document.querySelector<HTMLInputElement>('input[type="search"]')!;
 const type=async(value:string)=>act(async()=>{search().value=value;search().dispatchEvent(new dom.window.Event('input',{bubbles:true}));});
 const select=async(path:string)=>act(async()=>document.querySelector<HTMLButtonElement>(`.file-row[title="${path}"]`)!.click());
 const close=async(path:string)=>act(async()=>document.querySelector<HTMLButtonElement>(`[aria-label="Zatvori karticu ${path}"]`)!.click());
 const tabs=()=>[...document.querySelectorAll<HTMLElement>('[role="tab"]')];
 assert.equal(document.querySelector<HTMLDetailsElement>('details')!.open,false);
 assert(document.querySelector('section[aria-label="Program i upute"] [title="BILJESKE.TXT"]'));
 await type('URS-WORK');
 assert.equal(document.querySelectorAll('.file-row').length,1);
 assert.equal(document.querySelector<HTMLDetailsElement>('details')!.open,true);
 await act(async()=>search().dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Enter',bubbles:true})));
 assert.equal(tabs().at(-1)!.getAttribute('aria-selected'),'true');
 assert.equal(document.querySelector('[role="tabpanel"]')!.textContent,files['urs-work.json']);
 await act(async()=>search().dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true})));
 assert.equal(search().value,'');assert.equal(document.querySelectorAll('.file-row').length,4);
 await select('lib/pomoc.py');
 assert.equal(tabs().length,3);
 await close('urs-work.json'); // Closing a background tab keeps the selected source.
 assert.equal(document.activeElement?.id,fileTabId('lib/pomoc.py'));
 assert.equal(document.querySelector('[role="tabpanel"]')!.textContent,files['lib/pomoc.py']);
 await act(async()=>document.activeElement!.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Delete',bubbles:true})));
 assert.equal(tabs().length,1);assert.equal(document.activeElement?.id,fileTabId('main.py'));
 assert.equal(document.querySelector('[aria-label="Zatvori karticu main.py"]'),null);
 await select('lib/pomoc.py');
 assert.equal(document.querySelector('[role="tabpanel"]')!.textContent,files['lib/pomoc.py']);
 await act(async()=>document.getElementById(fileTabId('lib/pomoc.py'))!.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Home',bubbles:true})));
 assert.equal(document.activeElement?.id,fileTabId('main.py'));
 assert.equal(document.getElementById(fileTabId('main.py'))!.getAttribute('aria-selected'),'true');
 await act(async()=>setFiles({'main.py':files['main.py'],'novi.py':files['lib/pomoc.py']}));
 assert.equal(tabs().length,1);assert.equal(document.getElementById(fileTabId('lib/pomoc.py')),null);
 await select('novi.py');assert.equal(tabs().length,2);
 await act(async()=>{setFiles({'main.py':files['main.py'],'preimenovan.py':files['lib/pomoc.py']});selectActive('preimenovan.py');});
 assert.equal(document.getElementById(fileTabId('novi.py')),null);
 assert.equal(tabs().length,2);assert.equal(document.getElementById(fileTabId('preimenovan.py'))!.getAttribute('aria-selected'),'true');
 assert.equal(document.querySelector('[role="tabpanel"]')!.textContent,files['lib/pomoc.py']);
 await type('nema-datoteke');assert.match(document.querySelector('.file-search-empty')!.textContent!,/Nema datoteke/);
 await act(async()=>document.querySelector<HTMLButtonElement>('.file-search-empty button')!.click());
 assert.equal(search().value,'');assert.equal(document.activeElement,search());
 await act(async()=>root.render(<Fixture key="second" id="second"/>));
 assert.equal(tabs().length,1);assert.equal(tabs()[0].id,fileTabId('main.py'));
 assert.equal(JSON.stringify(files),original);
});
test('25B variant preview does not open or mutate work; changing target clears the previous choice',async t=>{
 const {root,dom}=await environment(t),calls:any[]=[];
 await act(async()=>root.render(<UrsCatalog busy={false} initialTarget="micropython" open={(...args)=>calls.push(args)}/>));
 const button=(text:string)=>[...document.querySelectorAll('button')].find(e=>e.textContent===text)!;
 await act(async()=>button('Pregled · LED i čekanje').click());
 assert.equal(calls.length,0);assert.match(document.querySelector('.variant-preview')!.textContent!,/zatvoren LED krug/);
 assert.match(document.querySelector('.variant-preview')!.textContent!,/LED i otpornik/);
 await act(async()=>button('Otvori vježbu · LED i čekanje').click());
 assert.deepEqual(calls,[['gpio','blink','micropython','uno']]);
 await act(async()=>{const target=document.querySelector('select')!;target.value='uno';target.dispatchEvent(new dom.window.Event('change',{bubbles:true}));});
 assert.equal(document.querySelector('.variant-preview'),null);assert.equal(calls.length,1);
 await act(async()=>button('Pregled · LED i čekanje').click());
 await act(async()=>button('Otvori vježbu · LED i čekanje').click());
 assert.equal(calls[1][2],'uno');
});
test('25B compact school work preserves points and revision, automatically exposes save errors and recovery',async t=>{
 const {root}=await environment(t);
 const project=JSON.parse(readFileSync('.build/school-catalog/gpio-button-micropython.json','utf8'));
 const work:SchoolWorkState={attempt:{id:1,assignmentId:2,studentId:3,number:1,status:'in_progress',revision:2,savedAt:'2026-11-18T12:00:00Z'},student:{id:3,username:'test',displayName:'Probni učenik'},assignment:{id:2,className:'4.f',task:{version:1,definition:{code:'URS01'}}},snapshot:{revision:2,project,contentHash:'a'.repeat(64),savedAt:'2026-11-18T12:00:00Z'}};
 const local=await prepareSchoolAttempt(work);let fail=false;
 globalThis.fetch=async(input:any)=>{
  const action=new URL(String(input),'https://school.test').searchParams.get('action');
  if(fail)throw Error('Nema veze sa školskim poslužiteljem.');
  const json=(v:any)=>new Response(JSON.stringify({application:'labosv2',csrfToken:'csrf',...v}));
  if(action==='session')return json({user:{id:3,role:'student',mustChangePassword:false},features:{centralStorage:true,submissions:true}});
  if(action==='attempt')return json(work);
  if(action==='grading')return json({grading:{status:'evaluated',points:7,maxPoints:10,revision:2}});
  throw Error('Unexpected '+action);
 };
 const render=async(key:string)=>act(async()=>{root.render(<SchoolWork key={key} project={local} expanded={false} confirm={()=>{}} open={async()=>{}}/>);await delay(30);});
 await render('saved');await act(async()=>{await delay(30);});
 assert.match(document.querySelector('.school-sync-top')!.textContent!,/Spremljeno na školskom poslužitelju/);
 assert(document.querySelector<HTMLElement>('#my-work')!.hidden);
 assert.match(document.querySelector('.school-grade-result')?.textContent??document.querySelector('.school-grading')!.textContent!,/7 \/ 10 potvrđenih bodova/);
 fail=true;await render('offline');await act(async()=>{await delay(30);});
 assert.equal(document.querySelector<HTMLElement>('#my-work')!.hidden,false);
 assert.match(document.querySelector('.school-sync-top')!.textContent!,/Nema veze/);
 const retry=[...document.querySelectorAll('button')].find(b=>b.textContent==='Spremi sada / ponovi');assert(retry&&!retry.disabled);
 fail=false;work.attempt.status='locked';work.submission={id:9,attemptId:1,revision:2,contentHash:'a'.repeat(64),submittedAt:'2026-11-18T12:02:00Z'};
 await render('locked');await act(async()=>{await delay(30);});
 assert.equal(document.querySelector<HTMLElement>('#my-work')!.hidden,false);
 assert.match(document.querySelector('.school-sync-top')!.textContent!,/zaključana/);
 assert(document.querySelector('.school-locked-submission'));
 assert(![...document.querySelectorAll('button')].some(b=>b.textContent==='Završi i zaključaj vježbu'));

});
