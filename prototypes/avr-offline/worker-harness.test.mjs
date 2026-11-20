// Runs the actual built browser Worker in a JS VM with an in-memory CacheStorage
// adapter. This tests browser-only Emscripten branches, but is NOT a real-browser
// service-worker, persistence, UI, or offline-network acceptance test.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const root=resolve('.build/avr-offline');
const bundle=await readFile(root+'/worker.js','utf8');
async function harness({corrupt=false}={}) {
  const blobs=new Map();let sequence=0,resolveMessage;
  class BrowserBlob extends Blob {constructor(parts,options){super(parts,options);this.parts=parts;}}
  class BrowserURL extends URL {
    static createObjectURL(blob){const key='blob:https://prototype/'+(++sequence);blobs.set(key,blob);return key;}
    static revokeObjectURL(url){blobs.delete(url);}
  }
  const scope={console,performance,crypto,structuredClone,WebAssembly,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,DataView,URL:BrowserURL,Blob:BrowserBlob,Response,CompressionStream,DecompressionStream,atob,btoa,setTimeout,clearTimeout,
    WorkerGlobalScope:class {},location:{href:'https://prototype/worker.js'},
    fetch:()=>{throw Error('Network fetch forbidden in Worker harness');},
    caches:{open:async()=>({match:async url=>{
      const name=new URL(url).pathname.split('/').pop();
      if(corrupt&&name==='cc1plus.js')return new Response('corrupted');
      return new Response(await readFile(root+'/toolchain/'+name+'.gz'),{headers:{'X-Labos-Compression':'gzip'}});
    }})},
    postMessage:message=>{if(message.type!=='progress')resolveMessage?.(message);}
  };
  scope.self=scope;
  const context=vm.createContext(scope);
  scope.importScripts=url=>{
    const blob=blobs.get(url);if(!blob)throw Error('Unexpected script fetch: '+url);
    const text=blob.parts.map(p=>typeof p==='string'?p:new TextDecoder().decode(p)).join('');
    vm.runInContext(text,context,{filename:url});
  };
  vm.runInContext(bundle,context,{filename:'worker.js'});
  return data=>new Promise((ok,bad)=>{
    const timer=setTimeout(()=>bad(Error('Harness timeout')),30000);
    resolveMessage=value=>{clearTimeout(timer);ok(value);};
    Promise.resolve(scope.onmessage({data})).catch(e=>{clearTimeout(timer);bad(e);});
  });
}
test('built browser Worker loads verified scripts without fetch and runs new code',async()=>{
  const send=await harness(), input={board:'uno',files:{'main.ino':'void setup(){Serial.begin(9600);Serial.println("WORKER_936");}\nvoid loop(){delay(100);}'}};
  const message=await send({type:'compile',input});assert.equal(message.type,'compiled',message.message);
  const run=await send({type:'simulate',input,result:message.result});assert.equal(run.type,'simulated',run.message);assert.match(run.result.serial,/WORKER_936/);
  const stale=await send({type:'simulate',input:{...input,board:'nano'},result:message.result});assert.equal(stale.type,'error');assert.match(stale.message,/promijenjeni/);
});
test('built Worker refuses corrupted cached JavaScript before execution',async()=>{
  const send=await harness({corrupt:true});const message=await send({type:'compile',input:{board:'uno',files:{'main.ino':'void setup(){} void loop(){}'}}});
  assert.equal(message.type,'error');assert.match(message.message,/Oštećena|nepotpuna/);
});
