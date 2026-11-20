// CI only. Uses the normal Labos UI and a separate persistent profile, then
// reopens in an OS network namespace with no usable interfaces or web server.
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir,readlink} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {validateIsolation} from './network-proof.mjs';
const browsers=createRequire(import.meta.url)('./ci/node_modules/playwright');
const engine=process.env.LAB_BROWSER_ENGINE||'chromium';assert(['chromium','webkit'].includes(engine));
const browserType=browsers[engine],launchArgs=engine==='chromium'?['--no-sandbox']:[];
const phase=process.argv[2];assert(['prepare','isolated'].includes(phase));
const root=resolve('dist'),profile=resolve('.build/avr-integrated-profile'+(engine==='webkit'?'-webkit':'')),reports=resolve('.build/avr-integrated-evidence'+(engine==='webkit'?'-webkit':''));
const currentManifest=JSON.parse(await readFile(root+'/offline-package.json','utf8'));
const prefix=currentManifest.base,origin='http://127.0.0.1:4190'+prefix;
let serveRoot=root;
await mkdir(reports,{recursive:true});
const evidence={phase,engine,success:false,checks:[],errors:[],namespace:await readlink('/proc/self/ns/net')};
let context,page,server;
async function open(){
 context=await browserType.launchPersistentContext(profile,{headless:true,offline:phase==='isolated',viewport:{width:1440,height:1100},args:launchArgs});
 evidence.browser=context.browser()?.version();page=await context.newPage();page.on('pageerror',e=>evidence.errors.push(e.message));
 const response=await page.goto(origin,{waitUntil:'domcontentloaded'});
 if(phase==='isolated')assert(response.fromServiceWorker(),'Labos navigation must use persisted app package');
 await page.getByRole('button',{name:'Prevedi',exact:true}).waitFor({timeout:30000});
 await page.waitForFunction(()=>!!navigator.serviceWorker.controller,null,{timeout:120000});
}
async function close(){if(context){await context.close();context=null;}}
async function panel(){await page.getByRole('button',{name:'Prevedi',exact:true}).click();await page.getByRole('button',{name:'Prevedi u pregledniku',exact:true}).waitFor();}
async function compile(){
 const button=page.getByRole('button',{name:'Prevedi u pregledniku',exact:true});await button.waitFor();
 await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.textContent==='Prevedi u pregledniku'&&!b.disabled));
 await page.evaluate(()=>{globalThis.__compilePulse={last:performance.now(),ticks:0,maxGap:0};globalThis.__compilePulseTimer=setInterval(()=>{const p=globalThis.__compilePulse,now=performance.now();p.maxGap=Math.max(p.maxGap,now-p.last);p.last=now;p.ticks++;},25);});
 await button.click();await page.waitForFunction(()=>document.querySelector('[data-testid="offline-avr-status"]')?.textContent.startsWith('Prevedeno'),null,{timeout:65000});
 const pulse=await page.evaluate(()=>{clearInterval(globalThis.__compilePulseTimer);return globalThis.__compilePulse;});
 assert(pulse.ticks>0,'UI event loop must keep running during compilation');assert(pulse.maxGap<2000,'UI blocked during compile: '+pulse.maxGap);(evidence.responsiveness??=[]).push(pulse);
}
async function run(marker){
 await page.getByRole('button',{name:'Pokreni offline rezultat',exact:true}).click();
 await page.waitForFunction(m=>document.querySelector('[aria-label="Izlaz programa"]')?.textContent.includes(m),marker,{timeout:30000});
 assert.match(await page.locator('pre[aria-label="Izlaz programa"]').textContent(),/Offline AVR prototip/);
 await page.locator('.avr-indicator.on').waitFor({timeout:10000});
 await page.getByRole('button',{name:'Zaustavi',exact:true}).click();
}
async function edit(code){
 const editor=page.locator('.cm-content');await editor.click();await editor.press('ControlOrMeta+a');await page.keyboard.insertText(code);
 await page.locator('.save-state.saved').waitFor({timeout:10000});
}
async function savedProject(){return page.evaluate(async()=>{
 const db=await new Promise((ok,bad)=>{const r=indexedDB.open('esp32-micropython-lab-v2',1);r.onsuccess=()=>ok(r.result);r.onerror=()=>bad(r.error);});
 const get=(store,key)=>new Promise((ok,bad)=>{const r=db.transaction(store,'readonly').objectStore(store).get(key);r.onsuccess=()=>ok(r.result);r.onerror=()=>bad(r.error);});
 const id=await get('meta','active'),record=await get('projects',id);db.close();return record.document;
 });}
async function projectContents(){return page.evaluate(async()=>{
 const db=await new Promise((ok,bad)=>{const r=indexedDB.open('esp32-micropython-lab-v2',1);r.onsuccess=()=>ok(r.result);r.onerror=()=>bad(r.error);});
 const records=await new Promise((ok,bad)=>{const r=db.transaction('projects','readonly').objectStore('projects').getAll();r.onsuccess=()=>ok(r.result);r.onerror=()=>bad(r.error);});db.close();
 return records.map(r=>({id:r.document.id,title:r.document.title,files:r.document.files,circuit:r.document.circuit})).sort((a,b)=>a.id.localeCompare(b.id));
 });}
try{
 if(phase==='prepare'){
  server=createServer(async(req,res)=>{try{
   const pathname=new URL(req.url,origin).pathname;if(!pathname.startsWith(prefix)){res.writeHead(404).end();return;}
   const rel=pathname.slice(prefix.length)||'index.html',path=resolve(serveRoot,rel);if(!path.startsWith(serveRoot+'/')){res.writeHead(403).end();return;}
   const data=await readFile(path),type={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.wasm':'application/wasm','.svg':'image/svg+xml'}[extname(path)]||'application/octet-stream';
   res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store'}).end(data);
  }catch{res.writeHead(404).end();}});await new Promise(r=>server.listen(4190,'127.0.0.1',r));
  // First install can be the deployed baseline. Use the same origin and profile
  // across the upgrade; do not clear any storage or replace the saved project.
  if(process.env.LAB_UPGRADE_BASELINE)serveRoot=resolve(process.env.LAB_UPGRADE_BASELINE);
  context=await browserType.launchPersistentContext(profile,{headless:true,viewport:{width:1440,height:1100},args:launchArgs});page=await context.newPage();page.on('pageerror',e=>evidence.errors.push(e.message));
  await page.goto(origin);await page.locator('input[accept=".zip,.json"]').waitFor({state:'attached'});
  await page.locator('input[accept=".zip,.json"]').setInputFiles({name:'integrated.json',mimeType:'application/json',buffer:await readFile(engine==='webkit'?'.build/avr-integrated-nano-fixture.json':'.build/avr-integrated-fixture.json')});
  await page.waitForFunction(()=>document.querySelector('.cm-content')?.textContent.includes('INTEGRATED_FIXTURE'));
  await page.getByRole('button',{name:'Prevedi',exact:true}).waitFor();
  await page.waitForFunction(()=>!!navigator.serviceWorker.controller,null,{timeout:120000});
  if(process.env.LAB_UPGRADE_BASELINE){
   await page.locator('.save-state.saved').waitFor({timeout:10000});
   const before=await projectContents(),active=(await savedProject()).id;
   const baseline=JSON.parse(await readFile(serveRoot+'/offline-package.json','utf8'));
   assert.equal(baseline.base,prefix);assert.notEqual(baseline.build,currentManifest.build);
   await page.evaluate(async()=>{localStorage.setItem('upgrade-sentinel','preserve');const c=await caches.open('upgrade-sentinel');await c.put('/upgrade-sentinel',new Response('preserve'));});
   await close();serveRoot=root;
   context=await browserType.launchPersistentContext(profile,{headless:true,viewport:{width:1440,height:1100},args:launchArgs});
   page=await context.newPage();page.on('pageerror',e=>evidence.errors.push(e.message));await page.goto(origin);
   await page.evaluate(async()=>{await (await navigator.serviceWorker.getRegistration()).update();});
   await page.waitForFunction(async()=>!!(await navigator.serviceWorker.getRegistration())?.waiting,null,{timeout:120000});
   await page.getByRole('button',{name:'Status aplikacije i offline rad',exact:true}).click();
   await page.getByRole('button',{name:'Spremi i otvori novu verziju',exact:true}).waitFor({timeout:120000});
   await Promise.all([page.waitForEvent('domcontentloaded'),page.getByRole('button',{name:'Spremi i otvori novu verziju',exact:true}).click()]);
   await page.getByRole('button',{name:'Prevedi',exact:true}).waitFor({timeout:30000});
   await page.waitForFunction(version=>document.body.innerText.includes(version),currentManifest.version,{timeout:30000});
   assert.equal((await savedProject()).id,active);assert.deepEqual(await projectContents(),before);
   const sentinel=await page.evaluate(async()=>({local:localStorage.getItem('upgrade-sentinel'),cache:await (await (await caches.open('upgrade-sentinel')).match('/upgrade-sentinel')).text()}));
   assert.deepEqual(sentinel,{local:'preserve',cache:'preserve'});
   evidence.upgrade={from:{version:baseline.version,build:baseline.build},to:{version:currentManifest.version,build:currentManifest.build},preservedProjects:before.length,cacheCleared:false};
   evidence.checks.push('Deployed baseline upgraded through normal Save and open new version button; existing project content, active project and unrelated caches preserved');
  }
  await panel();await page.getByRole('button',{name:'Pripremi offline prevoditelj',exact:true}).click();
  await page.getByRole('button',{name:'Prevedi u pregledniku',exact:true}).click();
  await page.getByRole('button',{name:'Prekini offline prevođenje',exact:true}).click();
  await page.getByTestId('offline-avr-status').filter({hasText:'otkazano'}).waitFor();
  assert(await page.getByRole('button',{name:'Pokreni offline rezultat',exact:true}).isDisabled());
  evidence.checks.push('Cancel responds during compilation; stale result stays disabled; a subsequent fresh compilation succeeds');
  await compile();await run('INTEGRATED_FIXTURE');
  evidence.saved=await savedProject();
  await page.evaluate(async()=>{localStorage.setItem('integrated-sentinel','preserve');const c=await caches.open('integrated-sentinel');await c.put('/sentinel',new Response('preserve'));});
  evidence.checks.push('Normal project import, separate package preparation, compile and live AVR simulation in main Labos UI');
 }else{
  const prepared=JSON.parse(await readFile(reports+'/prepare.json','utf8'));assert(prepared.success);
  const ip=spawnSync('ip',['-j','link','show'],{encoding:'utf8'});assert.equal(ip.status,0);evidence.links=JSON.parse(ip.stdout);
  validateIsolation({namespace:evidence.namespace,onlineNamespace:prepared.namespace,links:evidence.links});
  await open();const p=await savedProject();assert.equal(p.id,prepared.saved.id);
  const marker='MAIN_OFFLINE_'+randomUUID().replaceAll('-',''),code=p.files['main.ino'].replace('INTEGRATED_FIXTURE',marker);
  await edit(code);await panel();assert(await page.getByRole('button',{name:'Pokreni offline rezultat',exact:true}).isDisabled());
  await compile();await run(marker);
  evidence.checks.push('New source edited, compiled and run in normal editor/console in OS network isolation');
  await panel();const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Izvezi prototipni rezultat',exact:true}).click();const download=await downloadPromise;
  const bundle=JSON.parse(await readFile(await download.path(),'utf8'));assert.equal(bundle.project.files['main.ino'],code);assert.equal(bundle.result.format,'labos-avr-prototype-build');
  await page.getByRole('button',{name:'Zatvori prozor',exact:true}).click();
  await edit('void setup(){ invalid syntax !!! }\nvoid loop(){}');await panel();await page.getByRole('button',{name:'Prevedi u pregledniku',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('[data-testid="offline-avr-status"]')?.textContent.includes('error:'),null,{timeout:65000});
  assert(await page.getByRole('button',{name:'Pokreni offline rezultat',exact:true}).isDisabled());
  await page.getByRole('button',{name:'Zatvori prozor',exact:true}).click();await page.getByRole('button',{name:'Pokreni',exact:true}).click();await page.getByRole('button',{name:'Prevedi u pregledniku',exact:true}).waitFor();
  assert(await page.getByRole('button',{name:'Pokreni offline rezultat',exact:true}).isDisabled());
  evidence.checks.push('Syntax error blocks old result through both offline button and main Run button');
  await page.getByRole('button',{name:'Zatvori prozor',exact:true}).click();
  await page.locator('input[accept=".zip,.json"]').setInputFiles({name:'restored_offline.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(bundle))});
  await page.waitForFunction(m=>document.querySelector('.cm-content')?.textContent.includes(m),marker);
  await panel();await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.textContent==='Pokreni offline rezultat'&&!b.disabled));await run(marker);
  evidence.checks.push('Exported prototype bundle reimported into main app, validated and executed without auto-run');
  const restored=await savedProject();await close();await open();assert.equal((await savedProject()).id,restored.id);
  // Run persisted output, then change and compile once more after full restart.
  await panel();await run(marker);const second=marker.replace('MAIN_OFFLINE_','RESTART_OFFLINE_');await edit(code.replace(marker,second));await panel();await compile();await run(second);
  evidence.checks.push('Full browser restart in isolation, persisted output executed, another new source compiled and run');
  await page.setViewportSize({width:390,height:844});await panel();
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:reports+'/mobile.png',fullPage:true});
  await page.setViewportSize({width:1440,height:1100});await page.screenshot({path:reports+'/desktop.png',fullPage:true});
  const sentinel=await page.evaluate(async()=>({local:localStorage.getItem('integrated-sentinel'),cache:await (await (await caches.open('integrated-sentinel')).match('/sentinel')).text()}));assert.deepEqual(sentinel,{local:'preserve',cache:'preserve'});
  evidence.checks.push('390 px and desktop compiler dialog checked; unrelated storage preserved');
 }
 assert.deepEqual(evidence.errors,[]);evidence.success=true;
}catch(e){evidence.error=e.stack;process.exitCode=1;console.error(e);}finally{
 if(page&&!evidence.success)await page.screenshot({path:reports+'/'+phase+'-failure.png',fullPage:true}).catch(()=>{});
 await close();if(server)await new Promise(r=>server.close(r));await writeFile(reports+'/'+phase+'.json',JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence));
}
