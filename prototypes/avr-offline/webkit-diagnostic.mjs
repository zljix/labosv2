import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const {webkit}=createRequire(import.meta.url)('./ci/node_modules/playwright');
await mkdir('.build/webkit-diagnostic',{recursive:true});
const evidence=[],server=createServer((req,res)=>{console.log('SERVER',req.url);res.writeHead(200,{'Content-Type':'text/html','Cache-Control':'no-store'});res.end('<!doctype html><title>Ready</title><h1>Ready</h1>');});
await new Promise(r=>server.listen(4190,'127.0.0.1',r));
for(const mode of ['new','initial']) {
 const context=await webkit.launchPersistentContext(resolve('.build/webkit-'+mode),{headless:true});
 const page=mode==='new'?await context.newPage():context.pages()[0];
 const e={mode,events:[]};evidence.push(e);
 page.on('request',r=>e.events.push(['request',r.url()]));page.on('response',r=>e.events.push(['response',r.status(),r.url()]));page.on('requestfailed',r=>e.events.push(['failed',r.url(),r.failure()]));page.on('pageerror',x=>e.events.push(['error',x.message]));page.on('crash',()=>e.events.push(['crash']));
 try {await page.goto('http://127.0.0.1:4190/labosv2/',{waitUntil:'domcontentloaded',timeout:15000});e.simple=await page.locator('h1').textContent();
 await page.goto('https://zljix.github.io/labosv2/',{waitUntil:'domcontentloaded',timeout:30000});await page.getByRole('button',{name:'Status aplikacije i offline rad',exact:true}).waitFor({timeout:15000});e.app=true;}catch(x){e.error=x.stack;}
 e.url=page.url();await page.screenshot({path:'.build/webkit-diagnostic/'+mode+'.png'}).catch(()=>{});await context.close();console.log(JSON.stringify(e));
}
await new Promise(r=>server.close(r));await writeFile('.build/webkit-diagnostic/results.json',JSON.stringify(evidence,null,2));
if(evidence.some(e=>!e.app))process.exitCode=1;
