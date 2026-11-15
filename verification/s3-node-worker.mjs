import {parentPort} from 'node:worker_threads';
const queued=[];let ready=false;
globalThis.self=globalThis;
globalThis.postMessage=data=>parentPort.postMessage(data);
parentPort.on('message',data=>{if(ready)globalThis.onmessage({data});else queued.push(data);});
await import('../public/s3-worker.mjs');ready=true;
for(const data of queued)globalThis.onmessage({data});
