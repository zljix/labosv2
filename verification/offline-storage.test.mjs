import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash, webcrypto } from 'node:crypto';
import vm from 'node:vm';

const origin = 'https://lab.example';
const builds = { current: '1111111111111111', active: '2222222222222222', waiting: '3333333333333333', page: '4444444444444444', stale: '5555555555555555' };
function environment({ base = '/labos/', quota = false, unknown = false, changing = false, invalid = false } = {}) {
  const prefix = 'esp32-micropython-lab-app-' + (base === '/' ? '' : encodeURIComponent(base) + '-');
  const names = Object.fromEntries(Object.entries(builds).map(([k, v]) => [k, prefix + v]));
  const records = new Map(Object.values(names).filter(n => n !== names.current).map(n => [n, new Map([[origin + base + 'retained', new Response(n)]])]));
  records.set('other-app', new Map());
  records.set('esp32-micropython-lab-app-%2Flabosv2%2F-6666666666666666', new Map());
  records.set(prefix + 'unrecognized', new Map());
  const handlers = {}, reports = [], deleted = [];
  let listed = 0, puts = 0, skip = 0;
  const clients = [{ id: 'page', url: origin + base, postMessage(data, ports) {
    if (data.type === 'LAB_CLIENT_BUILD') { if (!unknown) ports[0].postMessage({ build: invalid ? 'development' : builds.page }); }
    else reports.push(data);
  } }];
  const reg = {
    active: { postMessage(_data, ports) { ports[0].postMessage({ build: builds.active }); } },
    waiting: { postMessage(_data, ports) { ports[0].postMessage({ build: builds.waiting }); } },
    installing: null,
  };
  const caches = {
    async keys() { return [...records.keys()]; },
    async delete(name) { deleted.push(name); return records.delete(name); },
    async open(name) {
      if (!records.has(name)) records.set(name, new Map());
      const map = records.get(name);
      return {
        async keys() { return [...map.keys()].map(url => new Request(url)); },
        async match(url) { return map.get(url)?.clone(); },
        async put(url, response) {
          puts++;
          if (quota === 'always' || (quota && records.has(names.stale))) throw new DOMException('Quota exceeded.', 'QuotaExceededError');
          map.set(url, response.clone());
        },
      };
    },
  };
  const body = '<html>Labos</html>';
  const pkg = { build: builds.current, version: '0.15.4-beta.1', base, files: [{ url: base + 'index.html', bytes: Buffer.byteLength(body), sha256: createHash('sha256').update(body).digest('hex') }] };
  const context = {
    self: { location: { origin }, registration: reg, clients: {
      async matchAll() { listed++; if (changing && listed >= 2) return [...clients, { id: 'new', url: origin + base }]; return clients; },
      async claim() {},
    }, addEventListener(type, fn) { handlers[type] = fn; }, async skipWaiting() { skip++; } },
    caches, fetch: async () => new Response(body), crypto: webcrypto, URL, Request, Response, Uint8Array, Set, Error, MessageChannel, setTimeout, clearTimeout,
    get indexedDB() { throw Error('Cleanup must never access project storage'); },
  };
  vm.runInNewContext(readFileSync('scripts/service-worker.js', 'utf8').replace('/* LAB_PACKAGE */', JSON.stringify(pkg)), context);
  return {
    records, names, deleted, reports, clients, reg, get puts() { return puts; }, get skipped() { return skip; },
    async install() { let pending; handlers.install({ waitUntil(p) { pending = p; } }); await pending; },
    async message(type, source = clients[0]) {
      let pending, result;
      handlers.message({ source, data: { type }, ports: [{ postMessage(value) { result = value; } }], waitUntil(p) { pending = p; } });
      await pending; return result;
    },
  };
}

for (const base of ['/', '/labos/']) test(`cleanup protects active, waiting, current and open-page builds and isolates ${base}`, async () => {
  const env = environment({ base });
  env.records.set(env.names.current, new Map());
  const before = await env.message('LAB_STORAGE');
  assert.equal(before.total, 5); assert.equal(before.removable, 1); assert.equal(env.deleted.length, 0);
  const result = await env.message('LAB_CLEAN_STORAGE');
  assert.equal(result.removed, 1); assert.equal(result.blocked, '');
  assert.deepEqual(env.deleted, [env.names.stale]);
  for (const name of ['current', 'active', 'waiting', 'page']) assert(env.records.has(env.names[name]));
  assert(env.records.has('other-app'));
  assert(env.records.has('esp32-micropython-lab-app-%2Flabosv2%2F-6666666666666666'));
});

test('unknown or non-release pages block cleanup without deleting any cache', async () => {
  for (const options of [{ unknown: true }, { invalid: true }]) {
    const env = environment(options);
    const result = await env.message('LAB_CLEAN_STORAGE');
    assert(result.blocked); assert.equal(result.removed, 0); assert.deepEqual(env.deleted, []);
  }
});

test('a tab opened during the handshake cancels deletion', async () => {
  const env = environment({ changing: true });
  const result = await env.message('LAB_CLEAN_STORAGE');
  assert.match(result.blocked, /promijenile/); assert.deepEqual(env.deleted, []);
});

test('a worker that cannot report its release blocks cleanup', async () => {
  const env = environment(); env.reg.waiting.postMessage = (_data, ports) => ports[0].postMessage({ error: 'unavailable' });
  assert((await env.message('LAB_CLEAN_STORAGE')).blocked); assert.deepEqual(env.deleted, []);
});

test('an installing release is protected and a changed worker cancels deletion', async () => {
  const env = environment();
  env.reg.installing = { postMessage(_data, ports) { ports[0].postMessage({ build: builds.stale }); } };
  assert.equal((await env.message('LAB_CLEAN_STORAGE')).removed, 0);
  assert.deepEqual(env.deleted, []);
  env.reg.installing = null;
  env.reg.active.postMessage = (_data, ports) => {
    ports[0].postMessage({ build: builds.active });
    env.reg.waiting = null;
  };
  const result = await env.message('LAB_CLEAN_STORAGE');
  assert.match(result.blocked, /promijenile/); assert.deepEqual(env.deleted, []);
});

test('cleanup rejects a source outside this laboratory', async () => {
  const env = environment();
  for (const source of [null, { id: 'foreign', url: origin + '/labosv2/' }, { id: 'foreign', url: 'https://other.example/labos/' }]) assert((await env.message('LAB_CLEAN_STORAGE', source)).error);
  assert.deepEqual(env.deleted, []);
});

test('quota failure reclaims only stale packages and retries verified bytes once', async () => {
  const env = environment({ quota: true });
  await env.install();
  assert.equal((await env.message('LAB_STATUS')).ready, true);
  assert(env.reports.some(r => r.type === 'LAB_STORAGE_CLEANED' && r.removed === 1));
  assert(!env.reports.some(r => r.type === 'LAB_PACKAGE_ERROR'));
  assert.equal(env.skipped, 0);
  for (const key of ['active', 'waiting', 'page']) assert(env.records.has(env.names[key]));
  assert.deepEqual(env.deleted, [env.names.current, env.names.stale]);
});

test('persistent quota failure reports storage advice, leaves no ready marker, and preserves protected caches', async () => {
  const env = environment({ quota: 'always' });
  await assert.rejects(env.install(), /Quota/);
  assert.equal((await env.message('LAB_STATUS')).ready, false);
  assert.equal(env.puts, 2, 'one retry only');
  assert(env.reports.some(r => r.type === 'LAB_PACKAGE_ERROR' && r.code === 'storage-quota'));
  for (const key of ['active', 'waiting', 'page']) assert(env.records.has(env.names[key]));
});

test('quota with an unconfirmed page does not delete its potential package', async () => {
  const env = environment({ quota: true, invalid: true });
  await assert.rejects(env.install(), /Quota/);
  assert(env.records.has(env.names.stale)); assert(env.records.has(env.names.page));
  assert.equal(env.puts, 1);
  assert(env.reports.some(r => r.type === 'LAB_PACKAGE_ERROR' && /kartic/.test(r.message)));
});

test('repair of a complete package does not rewrite it or trigger cleanup', async () => {
  const env = environment(); await env.install();
  const puts = env.puts;
  assert.equal((await env.message('LAB_REPAIR')).ready, true);
  assert.equal(env.puts, puts); assert.deepEqual(env.deleted, []);
});
