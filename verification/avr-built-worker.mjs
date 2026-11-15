import {parentPort,workerData} from 'node:worker_threads';
globalThis.onmessage=undefined;
globalThis.postMessage=data=>parentPort.postMessage(data);
await import(workerData.path);
parentPort.on('message',data=>globalThis.onmessage({data}));
