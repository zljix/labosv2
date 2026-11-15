import {parentPort} from 'node:worker_threads';
const queued=[];let ready=false;
globalThis.postMessage=data=>parentPort.postMessage(data);
globalThis.onmessage=undefined;
parentPort.on('message',data=>{if(ready)globalThis.onmessage({data});else queued.push(data);});
await import('../src/runtime/avrWorker.ts');ready=true;
for(const data of queued)globalThis.onmessage({data});
