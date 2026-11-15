import {parentPort,workerData} from 'node:worker_threads';
globalThis.self=globalThis;
globalThis.onmessage=null;
globalThis.postMessage=data=>parentPort.postMessage(data);
await import(workerData.path);
parentPort.on('message',data=>globalThis.onmessage({data}));
