import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {mkdir,writeFile,readFile,readlink} from 'node:fs/promises';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {validateIsolation} from './network-proof.mjs';
const {webkit}=createRequire(import.meta.url)('./ci/node_modules/playwright');
const phase=process.argv[2],origin='http://127.0.0.1:4173';
await mkdir('.build/webkit-diagnostic',{recursive:true});
const e={phase,namespace:await readlink('/proc/self/ns/net')};let server;
if(phase==='prepare'){
 server=createServer((req,res)=>{res.writeHead(200,{'Content-Type':req.url==='/sw.js'?'text/javascript':'text/html','Cache-Control':'no-store'});res.end(req.url==='/sw.js'?`self.addEventListener('install',e=>e.waitUntil(self.skipWaiting()));self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));self.addEventListener('fetch',e=>e.respondWith(new Response('<h1>Offline SW</h1>',{headers:{'Content-Type':'text/html'}})));`:'<h1>Initial</h1>');});
 await new Promise(r=>server.listen(4173,'127.0.0.1',r));
}else{
 const before=JSON.parse(await readFile('.build/webkit-diagnostic/prepare.json','utf8')),ip=spawnSync('ip',['-j','link','show'],{encoding:'utf8'});
 e.links=JSON.parse(ip.stdout);validateIsolation({namespace:e.namespace,onlineNamespace:before.namespace,links:e.links});
}
const context=await webkit.launchPersistentContext(resolve('.build/webkit-offline-profile'),{headless:true,offline:false}),page=await context.newPage();
try{
 const response=await page.goto(origin,{waitUntil:'domcontentloaded'});
 if(phase==='prepare'){await page.evaluate(()=>navigator.serviceWorker.register('/sw.js'));await page.waitForFunction(()=>!!navigator.serviceWorker.controller);await page.reload();}
 else {e.fromServiceWorker=response.fromServiceWorker();assert(e.fromServiceWorker);}
 assert.equal(await page.locator('h1').textContent(),'Offline SW');e.success=true;
}catch(x){e.error=x.stack;process.exitCode=1;}
await page.screenshot({path:'.build/webkit-diagnostic/'+phase+'.png'});await context.close();if(server)await new Promise(r=>server.close(r));await writeFile('.build/webkit-diagnostic/'+phase+'.json',JSON.stringify(e,null,2));console.log(JSON.stringify(e));
