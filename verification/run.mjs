import { Worker } from 'node:worker_threads';
import { readFile, writeFile } from 'node:fs/promises';
import { runSuite } from '../dist/suite.mjs';

const machine = await readFile(new URL('../dist/machine.py', import.meta.url), 'utf8');
const factory = () => {
  const worker = new Worker(new URL('./node-worker.mjs', import.meta.url));
  const shim = { postMessage: data => worker.postMessage(data), terminate: () => worker.terminate() };
  worker.on('message', data => shim.onmessage?.({ data }));
  worker.on('error', error => shim.onerror?.(error));
  return shim;
};
const report = await runSuite(factory, machine, r => {
  if (r.status !== 'running') console.log(`${r.status.toUpperCase()} ${r.id}: ${JSON.stringify(r.detail)}`);
});
report.engine = process.version;
report.platform = process.platform + '/' + process.arch;
await writeFile(new URL('../docs/results-node.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
if (report.passed !== report.total) process.exitCode = 1;
