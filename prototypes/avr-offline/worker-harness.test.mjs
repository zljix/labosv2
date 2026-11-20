// Actual built browser code in isolated Node threads with CacheStorage adapters.
// This is not a physical mobile-browser acceptance test.
import test from 'node:test';
import assert from 'node:assert/strict';
import {Worker} from 'node:worker_threads';
import {resolve} from 'node:path';
function harness({corrupt=false}={}) {
 const worker=new Worker(new URL('./worker-harness-runtime.mjs',import.meta.url),{workerData:{root:resolve('.build/avr-offline'),entry:'worker.js',corrupt}}),reads=[];
 worker.on('message',data=>{if(data.type==='audit')reads.push(data);});
 return {reads,close:()=>worker.terminate(),send:data=>new Promise((ok,bad)=>{
  const finish=(error,value)=>{clearTimeout(timer);worker.off('message',onMessage);worker.off('error',onError);error?bad(error):ok(value);};
  const onMessage=value=>{if(!['progress','audit'].includes(value.type))finish(null,value);};
  const onError=error=>finish(error);const timer=setTimeout(()=>finish(Error('Harness timeout')),60000);
  worker.on('message',onMessage);worker.on('error',onError);worker.postMessage(data);
 })};
}
test('built Worker compiles Nano in disposable tool threads without loading the unused C compiler',async()=>{
 const h=harness();try {
  const input={board:'nano',files:{'main.ino':'void setup(){Serial.begin(9600);Serial.println("WORKER_936");}\nvoid loop(){delay(100);}'}};
  const message=await h.send({type:'compile',input});assert.equal(message.type,'compiled',message.message);
  assert(h.reads.length);assert(h.reads.every(r=>r.entry===(r.name.endsWith('.wasm')?'window':'tool-worker.js')));
  assert(!h.reads.some(r=>r.name==='cc1.js'||r.name==='cc1.wasm'));
  const run=await h.send({type:'simulate',input,result:message.result});assert.equal(run.type,'simulated',run.message);assert.match(run.result.serial,/WORKER_936/);
  const stale=await h.send({type:'simulate',input:{...input,board:'uno'},result:message.result});assert.equal(stale.type,'error');assert.match(stale.message,/promijenjeni/);
 } finally {await h.close();}
});
test('built Worker refuses corrupted cached JavaScript before execution',async()=>{
 const h=harness({corrupt:true});try {
  const message=await h.send({type:'compile',input:{board:'uno',files:{'main.ino':'void setup(){} void loop(){}'}}});
  assert.equal(message.type,'error');assert.match(message.message,/Oštećena|nepotpuna/);
 } finally {await h.close();}
});
test('window loader rejects corrupted WASM before a tool can execute it',async()=>{
 const h=harness({corrupt:'wasm'});try {
  const message=await h.send({type:'compile',input:{board:'nano',files:{'main.ino':'void setup(){} void loop(){}'}}});
  assert.equal(message.type,'error');assert.match(message.message,/Oštećena|nepotpuna/);
  assert(!h.reads.some(r=>r.entry==='tool-worker.js'));
 } finally {await h.close();}
});
