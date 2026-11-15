import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve as pathResolve } from 'node:path';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { Worker } from 'node:worker_threads';

const dist = pathResolve('dist'), origin = 'https://lab.example';
const manifest = JSON.parse(readFileSync(pathResolve(dist, 'offline-package.json')));
const source = readFileSync(pathResolve(dist, 'sw.js'), 'utf8');
function environment({ corrupt, redirect, quota = false, tabs = 1, network = true, caches: prior } = {}) {
  const handlers = {}, records = prior ?? new Map();
  let requests = 0, skipped = 0, claims = 0, online = network;
  const key = request => typeof request === 'string' ? request : request.url;
  const caches = {
    async open(name) {
      if (!records.has(name)) records.set(name, new Map());
      const data = records.get(name);
      return {
        async put(request, response) { if (quota) throw Error('QuotaExceededError'); data.set(key(request), response.clone()); },
        async match(request) { return data.get(key(request))?.clone(); },
        async keys() { return [...data.keys()].map(url => new Request(url)); },
      };
    },
    async delete(name) { return records.delete(name); },
    async keys() { return [...records.keys()]; },
  };
  const fetch = async request => {
    ++requests;
    if (!online) throw Error('Network unavailable');
    const url = new URL(key(request));
    if (url.pathname === redirect) return new Response('Sign in', { status: 302 });
    if (url.pathname === corrupt) return new Response('<html>unexpected login or stale fallback</html>');
    return new Response(readFileSync(pathResolve(dist, '.' + url.pathname)));
  };
  vm.runInNewContext(source, {
    self: { location: { origin }, addEventListener: (type, fn) => { handlers[type] = fn; }, skipWaiting: async () => { ++skipped; }, clients: { claim: async () => { ++claims; }, matchAll: async () => Array.from({ length: tabs }, (_, id) => ({ id })) } },
    fetch, caches, crypto: webcrypto, URL, Request, Response, Uint8Array, Set, Error,
  });
  const event = async type => { let result; handlers[type]({ waitUntil: value => { result = value; } }); await result; };
  const message = async type => { let result, reply; handlers.message({ data: { type }, ports: [{ postMessage: value => { reply = value; } }], waitUntil: value => { result = value; } }); await result; return reply; };
  const request = async (path, method = 'GET') => {
    let response;
    handlers.fetch({ request: new Request(new URL(path, origin), { method }), respondWith: result => { response = result; } });
    return response ? await response : undefined;
  };
  return { event, message, request, records, get requests() { return requests; }, get skipped() { return skipped; }, get claims() { return claims; }, offline: () => { online = false; } };
}
test('package covers shell, lazy editor, every runtime dependency, drivers, manual and valid install icons', () => {
  const urls = new Set(manifest.files.map(file => file.url));
  for (const file of ['/index.html', '/guide.html', '/manifest.webmanifest', '/pilot.html', '/worker.mjs', '/runtime/micropython.wasm', '/icons/lab-192.png', '/icons/lab-512.png']) assert(urls.has(file), file);
  assert([...urls].some(url => /CodeEditor.*\.js$/.test(url)), 'lazy editor must work before first online visit');
  for (const name of ['s3-worker.mjs', 's3-engine.mjs', 's3-contract.mjs', 's3-core-lock.mjs', 'arduino-contract.mjs', 's3-examples.json', 'worker.mjs', 'host.mjs', 'circuit-host.mjs', 'quadrature-inputs.mjs', 'drivers/lab_encoder.py', 'i2c-host.mjs', 'peripherals.mjs', 'machine.py', 'runtime/micropython.mjs', 'runtime/micropython.wasm', 'drivers/aht10.py', 'drivers/ssd1306.py', 'drivers/servo.py']) assert(urls.has(`/app/${manifest.build}/${name}`), name);
  for (const size of [192, 512]) {
    const bytes = readFileSync(pathResolve(dist, `icons/lab-${size}.png`));
    assert.equal(bytes.readUInt32BE(16), size); assert.equal(bytes.readUInt32BE(20), size);
  }
});
test('verified package reopens shell and executes file requests without any network', async () => {
  const env = environment();
  await env.event('install');
  assert.equal(env.skipped, 0, 'installation must wait rather than replace the current release');
  const status = await env.message('LAB_STATUS');
  assert.equal(status.ready, true); assert.equal(status.build, manifest.build);
  const count = env.requests; env.offline();
  assert.match(await (await env.request('/')).text(), /ESP32 MicroPython Lab/);
  for (const file of manifest.files) assert.equal((await env.request(file.url)).status, 200, file.url);
  assert.equal(env.requests, count, 'all app requests used CacheStorage');
});
test('incorrect bytes or login/fallback response cannot install an eligible package', async () => {
  for (const options of [{ corrupt: '/runtime/micropython.wasm' }, { redirect: '/index.html' }]) {
    const env = environment(options);
    await assert.rejects(env.event('install'));
    assert.equal((await env.message('LAB_STATUS')).ready, false);
    assert.equal(env.skipped, 0);
  }
});
test('quota failure cannot advertise a partially stored package', async () => {
  const env = environment({ quota: true });
  await assert.rejects(env.event('install'), /Quota/);
  assert.equal((await env.message('LAB_STATUS')).ready, false);
});
test('an evicted asset invalidates offline readiness', async () => {
  const env = environment(); await env.event('install');
  const data = [...env.records.values()][0]; data.delete(origin + '/runtime/micropython.wasm');
  assert.equal((await env.message('LAB_STATUS')).ready, false);
  assert.equal((await env.message('LAB_REPAIR')).ready, true);
  env.offline();
  assert.equal((await env.request('/runtime/micropython.wasm')).status, 200);
});
test('an update needs an explicit message and refuses more than one open tab', async () => {
  const env = environment({ tabs: 2 }); await env.event('install');
  assert.match((await env.message('LAB_ACTIVATE')).error, /druge kartice/); assert.equal(env.skipped, 0);
  const single = environment(); await single.event('install');
  assert.equal((await single.message('LAB_ACTIVATE')).accepted, true); assert.equal(single.skipped, 1);
});
test('upgrade retains previous content-addressed runtime and does not cache unrelated or private requests', async () => {
  const records = new Map([['esp32-micropython-lab-app-previous', new Map([[origin + '/app/previous/machine.py', new Response('# previous runtime')]])]]);
  const env = environment({ caches: records }); await env.event('install'); await env.event('activate');
  env.offline();
  assert.equal(await (await env.request('/app/previous/machine.py')).text(), '# previous runtime');
  assert.equal(env.claims, 1);
  for (const url of ['/api/private', '/project.json', '/login', '/?code=private', 'https://other.example/worker.mjs']) assert.equal(await env.request(url), undefined);
  assert.equal(await env.request('/worker.mjs', 'POST'), undefined);
  assert(records.has('esp32-micropython-lab-app-previous'));
});
test('content-addressed production Worker actually runs MicroPython and framebuf', async () => {
  // Run the exact release copy, not only the old compatibility URL.
  const worker = new Worker(`const {parentPort}=await import('node:worker_threads');globalThis.self=globalThis;globalThis.postMessage=d=>parentPort.postMessage(d);await import(${JSON.stringify(new URL(`../dist/app/${manifest.build}/worker.mjs`, import.meta.url).href)});parentPort.on('message',data=>globalThis.onmessage({data}));`, { eval: true, type: 'module' });
  try {
    const output = await new Promise((resolve, reject) => {
      let text = '';
      const timer = setTimeout(() => reject(Error('Runtime timeout')), 8000);
      worker.on('error', error => { clearTimeout(timer); reject(error); });
      worker.on('message', data => {
        if (data.type === 'console') text += data.text;
        if (data.type === 'error') { clearTimeout(timer); reject(Error(data.message)); }
        if (data.type === 'done') { clearTimeout(timer); resolve(text); }
      });
      worker.postMessage({ type: 'run', session: 1, machine: readFileSync(pathResolve(dist, `app/${manifest.build}/machine.py`), 'utf8'), code: "from machine import Pin\nimport framebuf\nfrom time import sleep_ms\np=Pin(4,Pin.OUT)\np.value(1)\nsleep_ms(10)\nassert p.value()==1\nf=framebuf.FrameBuffer(bytearray(8),8,8,framebuf.MONO_VLSB)\nf.pixel(1,1,1)\nassert f.pixel(1,1)==1\nprint('PACKAGE_OK')\n", files: {} });
    });
    assert.match(output, /PACKAGE_OK/);
  } finally { await worker.terminate(); }
});
