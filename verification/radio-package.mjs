// Actual final bundled two-node Worker plus release-relative MP WASM/glue.
import {Worker} from 'node:worker_threads';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {radioNodeProject} from '../src/radio/examples.ts';
import {buildFile,validateArtifact} from '../public/arduino-contract.mjs';
const manifest=JSON.parse(readFileSync('dist/offline-package.json','utf8')),release=resolve('dist/app/'+manifest.build),artifacts=JSON.parse(readFileSync(release+'/radio-examples.json','utf8'));
const bundle=manifest.files.find(f=>/^\/assets\/worker-.*\.js$/.test(f.url));assert(bundle);
const results=[];
for(const [a,b]of [['micropython','uno'],['nano','micropython'],['s3-cpp','nano'],['uno','s3-cpp'],['micropython','micropython'],['s3-cpp','s3-cpp']]){
 const nodes=[radioNodeProject(a,'tx'),radioNodeProject(b,'rx')];for(const [i,target,role]of [[0,a,'tx'],[1,b,'rx']])if(nodes[i].language==='arduino-cpp')nodes[i].files[buildFile(nodes[i])]=JSON.stringify(await validateArtifact(nodes[i],artifacts[target][role]));
 const worker=new Worker(new URL('./avr-built-worker.mjs',import.meta.url),{workerData:{path:pathToFileURL(resolve('dist'+bundle.url)).href}}),logs={A:'',B:''},frames={};let radio;const start=performance.now();
 try{
  await new Promise((done,reject)=>{
   const timer=setTimeout(()=>reject(Error(a+' → '+b+' timeout '+JSON.stringify(logs))),30000);
   worker.on('error',e=>{clearTimeout(timer);reject(e);});
   worker.on('message',e=>{if(e.type==='error'){clearTimeout(timer);reject(Error(e.message));return;}if(e.type==='console')logs[e.node]=(logs[e.node]+e.text).slice(-24000);if(e.type==='simulation')frames[e.node]=e;if(e.type==='radio')radio=e;
    if(/TX 10 ACK/.test(logs.A)&&/RX 10\r?\n/.test(logs.B)&&radio?.trace?.filter(e=>e.kind==='ack').length===10){clearTimeout(timer);done();}
   });
   worker.postMessage({type:'run',session:421,nodes,impair:{dropAck:1},machine:readFileSync(release+'/machine.py','utf8'),runtimeBase:pathToFileURL(release+'/').href});
  });
  assert.equal((logs.B.match(/RX 1\r?\n/g)??[]).length,1);assert.equal(radio.attempts,11);assert.equal(Object.values(frames.B.radios)[0].received,10);assert(radio.trace.some(e=>e.kind==='retry'));
  const observedMs=performance.now()-start,at=performance.now();await worker.terminate();const stopMs=performance.now()-at;assert(stopMs<500);
  results.push({a,b,status:'pass',build:manifest.build,observedMs,stopMs,console:logs,radio});
 }finally{await worker.terminate();}
}
writeFileSync('docs/stage21-evidence/packaged-radio.json',JSON.stringify(results,null,2)+'\n');
console.log(JSON.stringify(results.map(({a,b,status,build,observedMs,stopMs})=>({a,b,status,build,observedMs,stopMs}))));
