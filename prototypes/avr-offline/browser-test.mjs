import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||((process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES||'')+'/playwright'));
const root=resolve('.build/avr-offline'), profile=resolve('.build/avr-prototype-profile'), port=4187, origin=`http://localhost:${port}/`;
const evidence={scope:'Local Chromium prototype, not school hardware',checks:[],compiles:[],networkAttempts:[],errors:[]};
await mkdir(profile,{recursive:true});
const server=createServer(async(req,res)=>{
  try{
    const pathname=decodeURIComponent(new URL(req.url,origin).pathname), path=resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
    if(!path.startsWith(root+'/')){res.writeHead(403).end();return;}
    const bytes=await readFile(path), type={'.html':'text/html','.js':'text/javascript','.css':'text/css','.wasm':'application/wasm','.json':'application/json','.md':'text/plain'}[extname(path)]||'application/octet-stream';
    res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-cache'}).end(bytes);
  }catch{res.writeHead(404).end();}
});
await new Promise(r=>server.listen(port,'127.0.0.1',r));
let context,page,offline=false;
async function open(offlineMode=false){
  context=await chromium.launchPersistentContext(profile,{headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox'],viewport:{width:1280,height:920}});
  if(offlineMode)await context.setOffline(true);
  evidence.browser=context.browser()?.version()||'persistent Chromium';
  page=await context.newPage();
  page.on('pageerror',e=>evidence.errors.push(e.message));
  // Worker shell loads can legitimately be fulfilled by the service worker.
  // Compiler/SDK requests or external endpoints during offline work are forbidden.
  page.on('request',r=>{if(offline&&r.url().startsWith('http')&&(r.url().includes('/toolchain/')||!r.url().startsWith(origin)))evidence.networkAttempts.push(r.url());});
  await page.goto(origin,{waitUntil:'networkidle'});
}
const state=()=>page.evaluate(()=>window.labosPrototype.getState());
async function waitDone(){await page.waitForFunction(()=>!window.labosPrototype.getState().busy,{},{timeout:65000});return state();}
async function compile(){
  await page.locator('#compile').click();const s=await waitDone();
  assert(s.result,await page.locator('#diagnostics').textContent());
  evidence.compiles.push({board:s.input.board,elapsedMs:s.result.elapsedMs,flash:s.result.flashBytes,ram:s.result.staticRamBytes,hash:s.result.hexHash,timings:s.result.timings});
  return s;
}
async function simulate(){await page.locator('#run').click();const s=await waitDone();assert(s.simulation,await page.locator('#diagnostics').textContent());assert.equal(s.simulation.faults.length,0);return s.simulation;}
async function code(text){await page.locator('#code').fill(text);}
try{
  await open();
  await page.locator('#prepare').click();
  await page.waitForFunction(()=>window.labosPrototype?.getState().ready,{},{timeout:120000});
  await page.locator('#board').selectOption('uno');await page.locator('#example').selectOption('blink');
  await page.evaluate(async()=>{localStorage.setItem('labos-unrelated-project-sentinel','preserve');const c=await caches.open('labos-unrelated-cache-sentinel');await c.put('/unrelated-sentinel',new Response('preserve'));});
  evidence.checks.push('package prepared and hashes checked');
  await compile();const initial=await simulate();assert.match(initial.serial,/Moj offline program/);assert(initial.samples.some(s=>s.level===1));assert(initial.samples.some(s=>s.level===0));
  const oldHash=(await state()).result.hexHash;
  offline=true;await context.setOffline(true);
  await page.locator('#code').fill((await state()).input.files['main.ino'].replace('INTERVAL = 200','INTERVAL = 73').replace('Moj offline program','OFFLINE_UNIQUE_7391'));
  const changed=await compile();assert.notEqual(changed.result.hexHash,oldHash);
  const changedRun=await simulate();assert.match(changedRun.serial,/OFFLINE_UNIQUE_7391/);assert.match(changedRun.serial,/OFF 7[23]/);assert(!changedRun.serial.includes('Moj offline program'));
  evidence.checks.push('source changed offline: new HEX, unique Serial text, changed LED timing');
  const onlineAttemptsBefore=evidence.networkAttempts.length;
  for(const board of ['uno','nano']){
    await page.locator('#board').selectOption(board);
    for(const example of ['multi','c']){await page.locator('#example').selectOption(example);await compile();assert.match((await simulate()).serial,example==='multi'?/REZULTAT=42/:/42/);}
    await page.locator('#example').selectOption('blink');await compile();const sim=await simulate();assert.match(sim.serial,/ON 0/);assert.match(sim.serial,/OFF 19[89]/);
  }
  assert.equal(evidence.networkAttempts.length,onlineAttemptsBefore,'compiling/simulating must not issue HTTP requests');
  evidence.checks.push('both boards: Blink/Serial, separate .cpp, separate .c run in actual Labos AVREngine offline; no HTTP compile requests');
  await code('void setup(){\n invalid syntax !!!\n}\nvoid loop(){}');await page.locator('#compile').click();await waitDone();assert.match(await page.locator('#diagnostics').textContent(),/main\.ino:2:/);assert.equal((await state()).result,null);assert(await page.locator('#run').isDisabled());
  evidence.checks.push('syntax error reports main.ino line 2; no stale result or execution');
  await page.locator('#example').selectOption('multi');await page.locator('#compile').click();await page.locator('#cancel').click();await page.waitForTimeout(500);assert.equal((await state()).result,null);assert(!(await state()).busy);await compile();
  evidence.checks.push('cancel terminates worker; next build succeeds');
  await page.locator('#compile').click();await code((await state()).input.files['main.ino']+'\n// changed during work');await page.waitForTimeout(500);assert.equal((await state()).result,null);assert(await page.locator('#run').isDisabled());
  evidence.checks.push('edit during compile cancels and rejects delayed output');
  await page.locator('#example').selectOption('blink');
  await code((await state()).input.files['main.ino'].replace('Moj offline program','PERSISTENT_REOPEN_982'));
  await context.close();context=null;
  // Same profile, server remains unavailable to browser, all browser processes restarted.
  await open(true);
  await page.waitForFunction(()=>window.labosPrototype?.getState().ready,{},{timeout:30000});
  assert.match((await state()).input.files['main.ino'],/PERSISTENT_REOPEN_982/);
  await compile();assert.match((await simulate()).serial,/PERSISTENT_REOPEN_982/);
  evidence.checks.push('browser fully closed/reopened offline in same profile; edited source and compiler survive');
  const preserved=await page.evaluate(async()=>({project:localStorage.getItem('labos-unrelated-project-sentinel'),cache:await (await (await caches.open('labos-unrelated-cache-sentinel')).match('/unrelated-sentinel')).text()}));
  assert.deepEqual(preserved,{project:'preserve',cache:'preserve'});
  evidence.checks.push('unrelated project and cache preserved; no cache clearing');
  await page.evaluate(async()=>{
    const name=(await caches.keys()).find(n=>n.startsWith('labos-avr-prototype-1-')),c=await caches.open(name),url=new URL('toolchain/cc1plus.js',location.href).href;
    const response=await c.match(url);window.savedCompilerHeaders=[...response.headers];
    window.savedCompilerResponse=await response.arrayBuffer();window.savedCompilerCache=name;
    await c.put(url,new Response('corrupted'));
  });
  await page.locator('#compile').click();await waitDone();assert.equal((await state()).result,null);assert.match(await page.locator('#diagnostics').textContent(),/Oštećena|nepotpuna/);
  await page.evaluate(async()=>{const c=await caches.open(window.savedCompilerCache);await c.put(new URL('toolchain/cc1plus.js',location.href).href,new Response(window.savedCompilerResponse,{headers:window.savedCompilerHeaders}));});
  await compile();assert.match((await simulate()).serial,/PERSISTENT_REOPEN_982/);
  evidence.checks.push('corrupt cached compiler rejected; restored package compiles again; source survives');
  await page.screenshot({path:resolve('.build/avr-prototype-desktop.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:resolve('.build/avr-prototype-mobile-layout.png'),fullPage:true});
  evidence.checks.push('390 px layout has no horizontal overflow; not a physical phone support claim');
  evidence.memory=await page.evaluate(()=>performance.memory?{usedJSHeapSize:performance.memory.usedJSHeapSize,scope:'page JS heap only; compiler workers terminated, not peak process memory'}:null);
  assert.deepEqual(evidence.errors,[]);evidence.success=true;
}catch(error){evidence.success=false;evidence.failure=error.stack;console.error(error);if(page)await page.screenshot({path:resolve('.build/avr-prototype-failure.png'),fullPage:true}).catch(()=>{});process.exitCode=1;}
finally{
  if(context)await context.close();await new Promise(r=>server.close(r));
  evidence.generatedAt=new Date().toISOString();await writeFile('.build/avr-offline-evidence.json',JSON.stringify(evidence,null,2)+'\n');
  console.log(JSON.stringify(evidence,null,2));
}
