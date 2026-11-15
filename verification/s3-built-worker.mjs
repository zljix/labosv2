import {parentPort,workerData} from 'node:worker_threads';
import {pathToFileURL} from 'node:url';
const queued=[];let ready=false;
globalThis.self=globalThis;globalThis.postMessage=data=>parentPort.postMessage(data);
parentPort.on('message',data=>{if(ready)globalThis.onmessage({data});else queued.push(data);});
await import(pathToFileURL(workerData.path).href);ready=true;
for(const data of queued)globalThis.onmessage({data});
