import {build} from 'esbuild';
import {readFile,writeFile,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
export async function buildShell({here,output}){
const shared={bundle:true,platform:'browser',target:'es2022',define:{__APP_BUILD__:'"prototype"',__APP_BASE__:'"./"',__APP_VERSION__:'"0.15.7-prototype.3"'},logLevel:'warning'};
await build({...shared,entryPoints:[here+'/app.mjs'],format:'esm',outfile:output+'/app.js'});
await build({...shared,entryPoints:[here+'/worker.ts'],format:'iife',outfile:output+'/worker.js'});
for(const name of ['index.html','style.css','README.md','PROJECT-BRIDGE.md','LIBRARIES.md'])await copyFile(here+'/'+name,output+'/'+name);
await copyFile(here+'/runtime-manifest.json',output+'/toolchain/manifest.json');
const shell=['index.html','app.js','worker.js','style.css','README.md','PROJECT-BRIDGE.md','LIBRARIES.md','toolchain/NOTICE.json'];
const hash=createHash('sha256');for(const name of shell)hash.update(await readFile(output+'/'+name));
const cache='labos-avr-prototype-shell-'+hash.digest('hex').slice(0,16);
await writeFile(output+'/sw.js',`const CACHE=${JSON.stringify(cache)}, FILES=${JSON.stringify(shell)};
self.addEventListener('install',e=>e.waitUntil((async()=>{const cache=await caches.open(CACHE);await cache.addAll(FILES.map(p=>new URL(p,self.registration.scope).href));await self.skipWaiting();})()));
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('fetch',e=>{const url=new URL(e.request.url);if(e.request.method!=='GET'||!url.href.startsWith(self.registration.scope))return;const relative=url.href.slice(self.registration.scope.length).split('?')[0];if(relative!==''&&!FILES.includes(relative))return;e.respondWith((async()=>{const cache=await caches.open(CACHE);const hit=await cache.match(new URL(relative||'index.html',self.registration.scope).href);return hit||fetch(e.request);})());});
`);
console.log('Prototype built:',output);
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const here=dirname(fileURLToPath(import.meta.url));
 await buildShell({here,output:resolve(here,'../../.build/avr-offline')});
}
