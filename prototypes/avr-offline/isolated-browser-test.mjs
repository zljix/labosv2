// Runs only on an explicitly provisioned test host / CI, never through the
// managed Work Mode preview. Two processes share a dedicated browser profile:
// prepare online, then verify inside a new Linux network namespace with lo down.
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir,readlink} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {validateIsolation} from './network-proof.mjs';
import runtime from './runtime-manifest.json' with {type:'json'};
import {EXAMPLES} from './examples.mjs';

const phase=process.argv[2];
assert(['prepare','isolated'].includes(phase),'Usage: isolated-browser-test.mjs prepare|isolated');
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'./ci/node_modules/playwright');
const root=resolve('.build/avr-offline'),profile=resolve('.build/avr-isolated-profile');
const reports=resolve('.build/avr-isolated-evidence'),origin='http://127.0.0.1:4187/';
await mkdir(profile,{recursive:true});await mkdir(reports,{recursive:true});
const evidence={phase,success:false,packageHash:runtime.packageHash,checks:[],compiles:[],errors:[],requests:[],responses:[]};
let context,page,server,monitor;
let maxRSS=0,samples=0;

function sampleMemory(){
  const result=spawnSync('ps',['-eo','pid=,ppid=,rss='],{encoding:'utf8'});
  if(result.status!==0)return;
  const rows=result.stdout.trim().split('\n').map(line=>line.trim().split(/\s+/).map(Number));
  const descendants=new Set([process.pid]);
  for(let changed=true;changed;){changed=false;for(const [pid,ppid] of rows)if(descendants.has(ppid)&&!descendants.has(pid)){descendants.add(pid);changed=true;}}
  const sum=rows.filter(([pid])=>pid!==process.pid&&descendants.has(pid)).reduce((n,row)=>n+row[2],0);
  maxRSS=Math.max(maxRSS,sum);samples++;
}
async function open(){
  context=await chromium.launchPersistentContext(profile,{headless:true,offline:phase==='isolated',viewport:{width:1280,height:920},
    ...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox']});
  evidence.browser=context.browser()?.version()??'Chromium persistent context';
  page=await context.newPage();
  page.on('pageerror',error=>evidence.errors.push(error.message));
  context.on('request',r=>{if(phase==='isolated'&&evidence.requests.length<300)evidence.requests.push({url:r.url(),serviceWorker:!!r.serviceWorker()});});
  context.on('response',r=>{if(phase==='isolated'&&evidence.responses.length<300)evidence.responses.push({url:r.url(),fromServiceWorker:r.fromServiceWorker()});});
  const response=await page.goto(origin,{waitUntil:'domcontentloaded',timeout:30000});
  if(phase==='isolated')assert(response?.fromServiceWorker(),'Offline navigation must be served by the persisted service worker');
  await page.waitForFunction(()=>window.labosPrototype&&navigator.serviceWorker.controller,null,{timeout:30000});
}
const state=()=>page.evaluate(()=>window.labosPrototype.getState());
async function settled(){await page.waitForFunction(()=>!window.labosPrototype.getState().busy,null,{timeout:65000});return state();}
async function compile(){
  await page.locator('#compile').click();const s=await settled();
  assert(s.result,await page.locator('#diagnostics').textContent());
  assert.equal(s.result.packageHash,runtime.packageHash);
  evidence.compiles.push({board:s.input.board,inputHash:s.result.inputHash,hexHash:s.result.hexHash,elapsedMs:s.result.elapsedMs,flashBytes:s.result.flashBytes,staticRamBytes:s.result.staticRamBytes});
  return s.result;
}
async function simulate(){
  await page.locator('#run').click();const s=await settled();
  assert(s.simulation,await page.locator('#diagnostics').textContent());assert.deepEqual(s.simulation.faults,[]);return s.simulation;
}
async function closeBrowser(){if(context){await context.close();context=null;page=null;}}
try{
  evidence.namespace=await readlink('/proc/self/ns/net');
  if(phase==='prepare'){
    server=createServer(async(req,res)=>{
      try{
        const pathname=decodeURIComponent(new URL(req.url,origin).pathname),path=resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
        if(!path.startsWith(root+'/')){res.writeHead(403).end();return;}
        const bytes=await readFile(path),type={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.md':'text/plain'}[extname(path)]||'application/octet-stream';
        res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store'}).end(bytes);
      }catch{res.writeHead(404).end();}
    });
    await new Promise(r=>server.listen(4187,'127.0.0.1',r));
    await open();await page.locator('#prepare').click();
    await page.waitForFunction(()=>window.labosPrototype.getState().ready,null,{timeout:120000});
    await page.locator('#board').selectOption('uno');await page.locator('#example').selectOption('blink');
    evidence.baseline=await compile();assert.match((await simulate()).serial,/Moj offline program/);
    const marker='PRESERVED_'+randomUUID().replaceAll('-','');
    await page.locator('#board').selectOption('nano');await page.locator('#code').fill(EXAMPLES.blink.files['main.ino'].replace('Moj offline program',marker));
    evidence.savedInput=(await state()).input;
    await page.evaluate(async()=>{
      localStorage.setItem('labos-isolated-sentinel','preserve');
      const cache=await caches.open('labos-isolated-sentinel');await cache.put('/sentinel',new Response('preserve'));
    });
    await closeBrowser();
    evidence.checks.push('Package verified, baseline compiled, source and unrelated sentinels persisted, full browser closed');
  }else{
    const prepared=JSON.parse(await readFile(reports+'/prepare.json','utf8'));
    assert(prepared.success);assert.equal(prepared.packageHash,runtime.packageHash);
    const ip=spawnSync('ip',['-j','link','show'],{encoding:'utf8'});assert.equal(ip.status,0,ip.stderr);
    evidence.links=JSON.parse(ip.stdout);
    validateIsolation({namespace:evidence.namespace,onlineNamespace:prepared.namespace,links:evidence.links});
    evidence.checks.push('Separate Linux network namespace: only loopback exists and remains down; no HTTP server started');
    monitor=setInterval(sampleMemory,200);sampleMemory();
    await open();await page.waitForFunction(()=>window.labosPrototype.getState().ready,null,{timeout:30000});
    assert.deepEqual((await state()).input,prepared.savedInput);
    evidence.checks.push('Full browser reopened in isolated namespace using the same profile; source and package preserved');
    const nonce=randomUUID().replaceAll('-','');evidence.newSourceNonce=nonce;
    for(const board of ['uno','nano']){
      await page.locator('#board').selectOption(board);
      for(const example of ['blink','multi','c']){
        await page.locator('#example').selectOption(example);
        if(example==='blink')await page.locator('#code').fill(EXAMPLES.blink.files['main.ino'].replace('Moj offline program',board+'_'+nonce).replace('INTERVAL = 200','INTERVAL = '+(board==='uno'?71:113)));
        if(example==='multi'){
          await page.getByRole('tab',{name:'helper.cpp',exact:true}).click();await page.locator('#code').fill('#include "helper.h"\nint dvostruko(int n){return n*3;}');
        }
        if(example==='c'){
          await page.getByRole('tab',{name:'helper.c',exact:true}).click();await page.locator('#code').fill('int zbroj(int a,int b){return a+b+1;}');
        }
        const result=await compile(),simulation=await simulate();
        assert.notEqual(result.hexHash,prepared.baseline.hexHash);
        assert.match(simulation.serial,example==='blink'?new RegExp(board+'_'+nonce):example==='multi'?/REZULTAT=63/:/43/);
        if(example==='blink')assert(simulation.samples.some(s=>s.level===1)&&simulation.samples.some(s=>s.level===0));
      }
    }
    evidence.checks.push('Uno and Nano: new Blink source, changed separate C++, changed separate C all compiled and simulated in network isolation');
    await page.locator('#example').selectOption('blink');
    await page.locator('#code').fill('void setup(){\n invalid syntax !!!\n}\nvoid loop(){}');
    await page.locator('#compile').click();await settled();assert.match(await page.locator('#diagnostics').textContent(),/main\.ino:2:/);
    assert.equal((await state()).result,null);assert(await page.locator('#run').isDisabled());
    await page.locator('#example').selectOption('multi');await page.locator('#compile').click();await page.locator('#cancel').click();
    await settled();assert.equal((await state()).result,null);await compile();
    evidence.checks.push('Syntax error rejects stale HEX; cancellation followed by a new compile succeeds');
    await page.locator('#example').selectOption('blink');
    await page.locator('#code').fill(EXAMPLES.blink.files['main.ino'].replace('Moj offline program','RESTART_'+nonce));
    await closeBrowser();await open();await page.waitForFunction(()=>window.labosPrototype.getState().ready,null,{timeout:30000});
    assert.match((await state()).input.files['main.ino'],new RegExp('RESTART_'+nonce));
    // Produce another new program only after the second completely offline launch.
    await page.locator('#code').fill((await state()).input.files['main.ino'].replace('RESTART_','AFTER_SECOND_START_'));
    await compile();assert.match((await simulate()).serial,new RegExp('AFTER_SECOND_START_'+nonce));
    const preserved=await page.evaluate(async()=>({project:localStorage.getItem('labos-isolated-sentinel'),cache:await (await (await caches.open('labos-isolated-sentinel')).match('/sentinel')).text()}));
    assert.deepEqual(preserved,{project:'preserve',cache:'preserve'});
    evidence.checks.push('Second full browser restart inside network isolation, another new source compiled, unrelated storage intact');
    // A real Labos project, supplied through the same file input as a user.
    // Its source is changed only inside the isolated network namespace.
    const project=JSON.parse(await readFile('.build/avr-project-fixture.json','utf8'));
    const upload=async value=>{
      await page.locator('#project-file').setInputFiles({name:'projekt.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(value))});
    };
    await upload(project);await page.waitForFunction(id=>window.labosPrototype.getState().project?.id===id,project.id);
    assert(await page.locator('#board').isDisabled());assert(await page.locator('#example').isDisabled());
    assert.equal((await state()).simulation,null,'Import never starts a program');
    const changed=project.files['main.ino'].replace('PROJECT_BRIDGE','PROJECT_'+nonce);
    await page.locator('#code').fill(changed);await compile();
    const projectSimulation=await simulate();assert.match(projectSimulation.serial,new RegExp('PROJECT_'+nonce));
    assert.equal(projectSimulation.projectId,project.id);assert(projectSimulation.lastFrame.leds.led1.currentMa>4);
    assert.deepEqual((await state()).project.circuit,project.circuit);
    async function downloadJSON(button){
      const pending=page.waitForEvent('download');await page.locator(button).click();const download=await pending;
      assert.equal(await download.failure(),null);return JSON.parse(await readFile(await download.path(),'utf8'));
    }
    const exported=await downloadJSON('#export-project');
    assert.equal(exported.files['main.ino'],changed);assert.equal(exported.files['biljeske.md'],project.files['biljeske.md']);
    assert.equal(exported.files['avr-build.json'],project.files['avr-build.json']);assert.deepEqual(exported.circuit,project.circuit);
    const bundle=await downloadJSON('#export-result');assert.equal(bundle.format,'labos-avr-offline-project');
    assert.equal(bundle.result.hexHash,(await state()).result.hexHash);
    const beforeRejected=await state();
    await upload({...exported,files:{...exported.files,'other.ino':'void helper(){}'}});
    await page.waitForFunction(()=>document.querySelector('#project-status').textContent.includes('other.ino'));
    assert.deepEqual(await state(),beforeRejected,'Rejected project import must preserve current state');
    await page.locator('#code').fill(changed+'\n// changed after export');assert(await page.locator('#run').isDisabled());
    await upload(bundle);await page.waitForFunction(()=>!!window.labosPrototype.getState().result);
    assert.equal((await state()).simulation,null);assert.equal((await state()).input.files['main.ino'],changed);
    await simulate();await closeBrowser();await open();
    await page.waitForFunction(()=>window.labosPrototype.getState().ready,null,{timeout:30000});
    const restored=await state();assert.deepEqual(restored.project,exported);assert.equal(restored.result,null);
    await page.locator('#code').fill(changed.replace('PROJECT_'+nonce,'PROJECT_REOPEN_'+nonce));
    await compile();assert.match((await simulate()).serial,new RegExp('PROJECT_REOPEN_'+nonce));
    evidence.checks.push('Real Labos project imported, edited, compiled and simulated with its own circuit in isolation; source and result exports round-trip, unsupported import leaves state intact, full restart preserves project and permits new compile');
    evidence.projectBridge={projectId:project.id,circuitPreserved:true,notesPreserved:true,legacyBuildPreserved:true,importDoesNotRun:true,exportRoundTrip:true,restartPreserved:true};
    await page.locator('#libraries input[value="DallasTemperature"]').check();
    assert(await page.locator('#libraries input[value="OneWire"]').isChecked());
    await page.locator('#libraries input[value="OneWire"]').uncheck();
    assert(!(await page.locator('#libraries input[value="DallasTemperature"]').isChecked()));
    await page.locator('#libraries input[value="U8g2"]').check();
    await page.locator('#libraries input[value="U8g2_12832"]').check();
    assert(!(await page.locator('#libraries input[value="U8g2"]').isChecked()));
    assert(await page.locator('#libraries input[value="U8g2_12832"]').isChecked());
    const libraryProject=JSON.parse(await readFile('.build/avr-library-fixture.json','utf8'));
    await upload(libraryProject);await page.waitForFunction(id=>window.labosPrototype.getState().project?.id===id,libraryProject.id);
    assert.equal(await page.locator('#libraries input:checked').count(),3);
    await page.locator('#duration').selectOption('3000');
    const librarySource=libraryProject.files['main.ino'].replace('Regulator spreman','LIBRARY_'+nonce);
    await page.locator('#code').fill(librarySource);await compile();
    let libraryRun=await simulate();assert.match(libraryRun.serial,new RegExp('LIBRARY_'+nonce));
    assert.match(libraryRun.serial,/T=24.00 RH=50.00 Servo=0/);
    assert(libraryRun.lastFrame.displays.oled1.bytes.some(Boolean));
    assert(Math.abs(libraryRun.lastFrame.servos.servo1.angle)<1);
    const checked=page.locator('#libraries input[value="Servo"]');
    await checked.uncheck();assert.equal((await state()).result,null);assert(await page.locator('#run').isDisabled());
    await checked.check();await compile();
    const libraryExport=await downloadJSON('#export-project');
    assert.equal(JSON.parse(libraryExport.files['arduino-libraries.json']).libraries.length,3);
    await closeBrowser();await open();await page.waitForFunction(()=>window.labosPrototype.getState().ready,null,{timeout:30000});
    assert.deepEqual((await state()).project,libraryExport);
    assert.equal(await page.locator('#libraries input:checked').count(),3);
    await page.locator('#duration').selectOption('3000');
    await page.locator('#code').fill(librarySource.replace('LIBRARY_','LIBRARY_RESTART_'));
    await compile();libraryRun=await simulate();assert.match(libraryRun.serial,new RegExp('LIBRARY_RESTART_'+nonce));
    assert(libraryRun.lastFrame.displays.oled1.bytes.some(Boolean));
    evidence.checks.push('Three selected libraries: actual Wire AHT10 + U8g2 OLED + Servo compiled and simulated offline, library change invalidates result, JSON selection and full restart preserve project, fresh source compiles after restart');
    evidence.libraries={selection:(await state()).input.libraries,serial:libraryRun.serial,servoAngle:libraryRun.lastFrame.servos.servo1.angle,displayBytes:libraryRun.lastFrame.displays.oled1.bytes.filter(Boolean).length};
    await page.screenshot({path:reports+'/isolated-desktop.png',fullPage:true});
    await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.screenshot({path:reports+'/isolated-mobile-layout.png',fullPage:true});
    assert.deepEqual(evidence.errors,[]);
  }
  evidence.success=true;
}catch(error){
  evidence.failure=error.stack;process.exitCode=1;console.error(error);
  if(page)await page.screenshot({path:reports+'/'+phase+'-failure.png',fullPage:true}).catch(()=>{});
}finally{
  if(monitor){clearInterval(monitor);sampleMemory();evidence.memory={sampledMaxChildRSSKiB:maxRSS,samples,intervalMs:200,scope:'Sum of descendant process RSS samples; includes shared pages multiple times, excludes Node host, not exact unique memory or Worker-only memory.'};}
  await closeBrowser();
  if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}
  evidence.generatedAt=new Date().toISOString();
  await writeFile(reports+'/'+phase+'.json',JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify(evidence,null,2));
}
