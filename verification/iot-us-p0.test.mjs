import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Worker} from 'node:worker_threads';
import {Session} from '../dist/session.mjs';

function createWorker() {
  const worker = new Worker(new URL('./node-worker.mjs', import.meta.url));
  const bridge = {postMessage: data => worker.postMessage(data), terminate: () => worker.terminate()};
  worker.on('message', data => bridge.onmessage?.({data}));
  worker.on('error', error => bridge.onerror?.(error));
  return bridge;
}

test('P0 repeats the student message on the browser MicroPython runtime', async () => {
  const filename = new URL('../public/zbirke/P0/01_Poruka.py', import.meta.url);
  const source = await readFile(filename, 'utf8');
  const machine = await readFile(new URL('../dist/machine.py', import.meta.url), 'utf8');
  const message = 'Provjera uceničke izmjene';
  const session = new Session(createWorker, machine, source.replace('ESP32-S3: program radi', message));
  try {
    await session.wait(s => s.status === 'error' || s.text.includes(message + '\n' + message), 12000);
    assert.equal(session.status, 'running', session.events.find(e => e.type === 'error')?.message);
  } finally {
    await session.stop();
  }
});

test('the three pilot programs parse on the MicroPython runtime distributed to students', async () => {
  const machine = await readFile(new URL('../dist/machine.py', import.meta.url), 'utf8');
  const programs = ['V1_4/01_Senzor.py', 'V2_1/01_HTTP.py', 'V3_1/01_Pinovi.py'];
  for (const program of programs) {
    const source = await readFile(new URL('../public/zbirke/' + program, import.meta.url), 'utf8');
    const session = new Session(createWorker, machine,
      "compile(open('izvor.py').read(), 'izvor.py', 'exec')", {}, () => {}, {'izvor.py': source});
    try {
      await session.wait(s => s.status === 'done' || s.status === 'error', 8000);
      assert.equal(session.status, 'done', program + ' ' + JSON.stringify(session.events.at(-1)));
    } finally {
      await session.stop();
    }
  }
});
