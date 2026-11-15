import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import { createHash, webcrypto } from 'node:crypto';
import { createServer } from 'node:http';
import vm from 'node:vm';

const dist = resolve('dist');
const manifest = JSON.parse(readFileSync(resolve(dist, 'offline-package.json')));
const base = manifest.base, origin = 'https://zljix.github.io';
const sw = readFileSync(resolve(dist, 'sw.js'), 'utf8');
const local = url => resolve(dist, new URL(url, origin).pathname.slice(base.length) || 'index.html');
const cachePrefix = 'esp32-micropython-lab-app-' + encodeURIComponent(base) + '-';

function worker({ corrupt = false, windows = [origin + base], prior = new Map() } = {}) {
  const handlers = {}, records = prior;
  let online = true, requests = 0, skipped = false;
  const key = value => typeof value === 'string' ? value : value.url;
  const caches = {
    async open(name) {
      if (!records.has(name)) records.set(name, new Map());
      const data = records.get(name);
      return {
        async put(request, response) { data.set(key(request), response.clone()); },
        async match(request) { return data.get(key(request))?.clone(); },
        async keys() { return [...data.keys()].map(url => new Request(url)); },
      };
    },
    async keys() { return [...records.keys()]; },
    async delete(name) { return records.delete(name); },
  };
  const fetch = async request => {
    ++requests;
    if (!online) throw Error('offline');
    const path = new URL(key(request)).pathname;
    assert(path.startsWith(base), 'offline install escaped the project prefix');
    return new Response(corrupt && path.endsWith('.wasm') ? 'wrong bytes' : readFileSync(local(path)));
  };
  vm.runInNewContext(sw, {
    self: { location: { origin }, addEventListener: (name, fn) => { handlers[name] = fn; },
      skipWaiting: async () => { skipped = true; }, clients: {
        claim: async () => {}, matchAll: async () => windows.map(url => ({ url })),
      } },
    caches, fetch, crypto: webcrypto, URL, Request, Response, Uint8Array, Set, Error,
  });
  return {
    records, get requests() { return requests; }, get skipped() { return skipped; },
    offline() { online = false; },
    async install() { let pending; handlers.install({ waitUntil: p => { pending = p; } }); await pending; },
    async message(type) {
      let pending, reply;
      handlers.message({ data: { type }, ports: [{ postMessage: v => { reply = v; } }], waitUntil: p => { pending = p; } });
      await pending; return reply;
    },
    async request(path) {
      let pending;
      handlers.fetch({ request: new Request(new URL(path, origin)), respondWith: p => { pending = p; } });
      return pending ? await pending : undefined;
    },
  };
}

test('Pages package contains the complete byte-verified application under its project prefix', () => {
  assert(base?.startsWith('/') && base !== '/' && base.endsWith('/'), 'run npm run build:pages first');
  assert(manifest.files.length >= 188);
  for (const file of manifest.files) {
    assert(file.url.startsWith(base), file.url);
    const bytes = readFileSync(local(file.url));
    assert.equal(bytes.length, file.bytes, file.url);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), file.sha256, file.url);
  }
});

test('entry page, copied guide, pilot and install manifest keep navigation inside the repository', () => {
  for (const name of ['index.html', 'guide.html', 'pilot.html']) {
    const html = readFileSync(resolve(dist, name), 'utf8');
    for (const [, path] of html.matchAll(/(?:href|src)=["'](\/[^"']+)["']/g)) {
      assert(path.startsWith(base) && !path.startsWith(base + base.slice(1)), path);
      assert.doesNotThrow(() => readFileSync(local(path)), path);
    }
  }
  const pwa = JSON.parse(readFileSync(resolve(dist, 'manifest.webmanifest')));
  for (const field of ['id', 'scope', 'start_url']) assert.equal(pwa[field], base);
  for (const icon of pwa.icons) assert(icon.src.startsWith(base));
});

test('HTTP delivery finds every prefixed file and serves WebAssembly with the correct type', async t => {
  const server = createServer((req, res) => {
    try {
      const path = new URL(req.url, 'http://localhost').pathname;
      if (!path.startsWith(base)) { res.writeHead(404); res.end(); return; }
      const file = path === base ? resolve(dist, 'index.html') : local(path);
      const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.wasm': 'application/wasm' };
      res.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream' });
      res.end(readFileSync(file));
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  t.after(() => new Promise(r => server.close(r)));
  const host = 'http://127.0.0.1:' + server.address().port;
  assert.match(await (await fetch(host + base)).text(), /ESP32 MicroPython Lab/);
  assert.equal((await fetch(host + '/assets/missing.js')).status, 404);
  for (const file of manifest.files) {
    const response = await fetch(host + file.url);
    assert.equal(response.status, 200, file.url);
    if (file.url.endsWith('.wasm')) assert.equal(response.headers.get('content-type'), 'application/wasm');
    assert.equal(createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex'), file.sha256);
  }
});

test('the installed Pages worker reopens the entire application without network access', async () => {
  const env = worker(); await env.install();
  assert.equal((await env.message('LAB_STATUS')).ready, true);
  const count = env.requests; env.offline();
  assert.match(await (await env.request(base)).text(), /ESP32 MicroPython Lab/);
  for (const file of manifest.files) assert.equal((await env.request(file.url)).status, 200, file.url);
  assert.equal(env.requests, count);
});

test('corrupt Pages runtime cannot be advertised as offline ready', async () => {
  const env = worker({ corrupt: true });
  await assert.rejects(env.install());
  assert.equal((await env.message('LAB_STATUS')).ready, false);
});

test('Pages cache and routing do not intercept another project on the same GitHub origin', async () => {
  const env = worker(); await env.install(); env.offline();
  assert([...env.records.keys()].every(name => name.startsWith(cachePrefix)));
  for (const path of ['/', '/other/', '/app/old/worker.mjs', '/assets/old.js', base + '?query=1']) {
    assert.equal(await env.request(path), undefined, path);
  }
});

test('old runtime files use only caches belonging to this project', async () => {
  const path = base + 'app/previous/machine.py';
  const prior = new Map([
    [cachePrefix + 'previous', new Map([[origin + path, new Response('# own previous runtime')]])],
    ['esp32-micropython-lab-app-other', new Map([[origin + path, new Response('# unrelated runtime')]])],
  ]);
  const env = worker({ prior }); await env.install(); env.offline();
  assert.equal(await (await env.request(path)).text(), '# own previous runtime');
});

test('other GitHub project tabs do not block an explicit update but two laboratory tabs do', async () => {
  const own = worker({ windows: [origin + base, origin + '/other/'] }); await own.install();
  assert.equal((await own.message('LAB_ACTIVATE')).accepted, true); assert.equal(own.skipped, true);
  const two = worker({ windows: [origin + base, origin + base + 'guide.html'] }); await two.install();
  assert.match((await two.message('LAB_ACTIVATE')).error, /druge kartice/); assert.equal(two.skipped, false);
});
