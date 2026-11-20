// Node-only browser Worker adapter. Each browser worker has its own thread/VM.
import {Worker as NodeWorker,parentPort,workerData} from 'node:worker_threads';
import vm from 'node:vm';
import {readFile,readFileSync} from 'node:fs';
import {promisify} from 'node:util';
const read=promisify(readFile),{root,entry,corrupt}=workerData;
const blobs=new Map();let sequence=0;
class BrowserBlob extends Blob {constructor(parts,options){super(parts,options);this.parts=parts;}}
class BrowserURL extends URL {
 static createObjectURL(blob){const key='blob:https://prototype/'+(++sequence);blobs.set(key,blob);return key;}
 static revokeObjectURL(url){blobs.delete(url);}
}
class BrowserWorker {
 constructor(url){
  this.worker=new NodeWorker(new URL(import.meta.url),{workerData:{root,entry:new URL(url).pathname.split('/').pop(),corrupt}});
  this.worker.on('message',data=>{if(data.type==='audit')parentPort.postMessage(data);else this.onmessage?.({data});});
  this.worker.on('error',e=>this.onerror?.({message:e.message}));
 }
 postMessage(message){this.worker.postMessage(message);}
 terminate(){return this.worker.terminate();}
}
const scope={console,performance,crypto,structuredClone,WebAssembly,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,DataView,URL:BrowserURL,Blob:BrowserBlob,Response,CompressionStream,DecompressionStream,atob,btoa,setTimeout,clearTimeout,
 Worker:BrowserWorker,WorkerGlobalScope:class {},location:{href:'https://prototype/'+entry},
 fetch:()=>{throw Error('Network fetch forbidden in Worker harness');},
 caches:{open:async()=>({match:async url=>{
  const name=new URL(url).pathname.split('/').pop();parentPort.postMessage({type:'audit',name,entry});
  if(corrupt&&name==='cc1plus.js')return new Response('corrupted');
  return new Response(await read(root+'/toolchain/'+name+'.gz'),{headers:{'X-Labos-Compression':'gzip'}});
 }})},
 postMessage:(message,transfer)=>parentPort.postMessage(message,transfer)
};
scope.self=scope;const context=vm.createContext(scope);
scope.importScripts=url=>{
 const blob=blobs.get(url);if(!blob)throw Error('Unexpected script fetch: '+url);
 const text=blob.parts.map(p=>typeof p==='string'?p:new TextDecoder().decode(p)).join('');
 vm.runInContext(text,context,{filename:url});
};
vm.runInContext(readFileSync(root+'/'+entry,'utf8'),context,{filename:entry});
parentPort.on('message',data=>Promise.resolve(scope.onmessage({data})).catch(e=>parentPort.postMessage({type:'error',message:e.message})));
