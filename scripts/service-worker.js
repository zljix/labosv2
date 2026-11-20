/* Generated with a content-addressed manifest at build time. No student data. */
const PACKAGE = /* LAB_PACKAGE */;
const BASE = PACKAGE.base ?? '/';
const PREFIX = 'esp32-micropython-lab-app-' + (BASE === '/' ? '' : encodeURIComponent(BASE) + '-');
const CACHE = PREFIX + PACKAGE.build;
const MARKER = BASE + '.lab-offline-ready';
const urls = new Set(PACKAGE.files.map(file => file.url));
const storedFiles = PACKAGE.files.filter(file => !file.cacheUrl);
const aliases = Object.fromEntries(PACKAGE.files.filter(file => file.cacheUrl).map(file => [file.url, file.cacheUrl]));
const origin = self.location.origin;
const key = path => new URL(path, origin).href;
const validBuild = build => typeof build === 'string' && /^[a-f0-9]{16}$/.test(build);
// Exact suffix matching matters for a root installation: its prefix also
// prefixes caches of other laboratories hosted in subdirectories.
const ownCache = name => name.startsWith(PREFIX) && validBuild(name.slice(PREFIX.length));
const ownClient = client => {
  try { const url = new URL(client.url); return url.origin === origin && url.pathname.startsWith(BASE); }
  catch { return false; }
};
function ask(target, type) {
  return new Promise((resolve, reject) => {
    const channel = new MessageChannel();
    const finish = (error, value) => {
      clearTimeout(timer); channel.port1.close(); channel.port2.close();
      if (error) reject(error); else resolve(value);
    };
    const timer = setTimeout(() => finish(Error('Nije moguće potvrditi verzije svih otvorenih kartica.')), 2000);
    channel.port1.onmessage = event => finish(null, event.data);
    try { target.postMessage({ type }, [channel.port2]); } catch (error) { finish(error); }
  });
}
const workers = () => [self.registration.active, self.registration.waiting, self.registration.installing];
async function storagePlan() {
  const names = (await caches.keys()).filter(ownCache);
  const result = { total: names.length, removable: [], blocked: '', clients: [], workers: [] };
  try {
    // Query even uncontrolled pages. An older page that cannot identify its
    // release blocks deletion, rather than being assumed unused.
    result.clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (result.clients.some(client => !client.url)) throw Error('Nije moguće provjeriti otvorene kartice.');
    result.clients = result.clients.filter(ownClient);
    result.workers = workers();
    const replies = await Promise.all([
      ...result.clients.map(client => ask(client, 'LAB_CLIENT_BUILD')),
      ...result.workers.filter(Boolean).map(worker => ask(worker, 'LAB_STATUS')),
    ]);
    if (replies.some(reply => !validBuild(reply?.build))) throw Error('Otvorena kartica ne potvrđuje svoju verziju.');
    const protectedNames = new Set([CACHE, ...replies.map(reply => PREFIX + reply.build)]);
    result.removable = names.filter(name => !protectedNames.has(name));
  } catch (error) { result.blocked = String(error?.message ?? error) + ' Zatvori druge kartice laboratorija i ponovno provjeri prostor.'; }
  return result;
}
async function cleanStorage() {
  const plan = await storagePlan();
  let removed = 0;
  if (!plan.blocked) {
    const ids = new Set(plan.clients.map(client => client.id));
    for (const name of plan.removable) {
      // Recheck after the asynchronous handshake and before each deletion.
      // A newly opened/navigated tab or changed registration cancels cleanup.
      const current = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      if (current.some(client => !client.url || (ownClient(client) && !ids.has(client.id))) || workers().some((worker, i) => worker !== plan.workers[i])) {
        plan.blocked = 'Otvorene kartice ili verzija aplikacije promijenile su se. Ponovno provjeri prostor.';
        break;
      }
      try { if (await caches.delete(name)) removed++; }
      catch { plan.blocked = 'Preglednik nije dopustio uklanjanje svih zastarjelih paketa. Projekti su sačuvani.'; break; }
    }
  }
  return { total: plan.total - removed, removable: plan.removable.length - removed, removed, blocked: plan.blocked };
}
let maintenance;
function maintainStorage() {
  if (!maintenance) maintenance = cleanStorage().finally(() => { maintenance = undefined; });
  return maintenance;
}

async function report(type, detail = {}) {
  // A diagnostic failure must never make a verified installation fail.
  try {
    for (const client of await self.clients.matchAll({ type: 'window', includeUncontrolled: true })) {
      if (client.url && new URL(client.url).pathname.startsWith(BASE)) client.postMessage?.({ type, build: PACKAGE.build, version: PACKAGE.version, ...detail });
    }
  } catch { /* The page may already have closed. */ }
}
async function verifiedResponse(file) {
  let failure;
  for (let attempt = 0; attempt < 2; attempt++) {
    const url = new URL(key(file.url));
    // An explicit content key on retry avoids a stale intermediary response.
    // The bytes are still verified and stored under the canonical offline URL.
    if (attempt) url.searchParams.set('lab-sha256', file.sha256);
    try {
      const response = await fetch(url.href, { cache: 'reload', credentials: 'same-origin', redirect: 'error' });
      if (!response.ok || response.redirected || (response.url && response.url !== url.href)) throw Error('Datoteka nije dostupna (HTTP ' + response.status + ').');
      const bytes = await response.clone().arrayBuffer();
      const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('');
      if (hash !== file.sha256 || bytes.byteLength !== file.bytes) throw Error('Sadržaj ne odgovara očekivanoj verziji.');
      return response;
    } catch (error) { failure = error; }
  }
  throw Error(file.url + ': ' + String(failure?.message ?? failure));
}
let preparation;
async function prepare() {
  if (preparation) return preparation;
  preparation = preparePackage().finally(() => { preparation = undefined; });
  return preparation;
}
async function preparePackage() {
  // Never rewrite an already complete package during a repair request.
  if ((await status()).ready) { await report('LAB_PACKAGE_READY'); return; }
  // Verify every byte before making the package eligible for offline use.
  // Redirects to an authentication page or an HTML fallback never become code.
  const responses = new Array(storedFiles.length);
  let next = 0, completed = 0, failure;
  await report('LAB_PACKAGE_PROGRESS', { completed, total: storedFiles.length });
  // Bounded concurrency shortens a large package install on high-latency links.
  // Drain every request before reporting failure; no partial package is ready.
  await Promise.all(Array.from({ length: Math.min(4, storedFiles.length) }, async () => {
    while (!failure && next < storedFiles.length) {
      const index = next++, file = storedFiles[index];
      try {
        responses[index] = [file.url, await verifiedResponse(file)];
        completed++;
        if (completed % 8 === 0 || completed === storedFiles.length) await report('LAB_PACKAGE_PROGRESS', { completed, total: storedFiles.length });
      } catch (error) { failure ??= error; }
    }
  }));
  if (failure) {
    await report('LAB_PACKAGE_ERROR', { message: failure.message });
    throw failure;
  }
  const save = async () => {
    const cache = await caches.open(CACHE);
    for (const [path, response] of responses) await cache.put(key(path), response.clone());
    await cache.put(key(MARKER), new Response(JSON.stringify({ build: PACKAGE.build, aliases }), { headers: { 'Content-Type': 'application/json' } }));
  };
  for (let attempt = 0; attempt < 2; attempt++) {
    try { await save(); await report('LAB_PACKAGE_READY'); return; }
    catch (error) {
      await caches.delete(CACHE).catch(() => {});
      const quota = error?.name === 'QuotaExceededError' || /quota/i.test(String(error?.message ?? error));
      let cleanup;
      if (quota && attempt === 0) {
        // Only stale application caches may be reclaimed. Never IndexedDB,
        // active/waiting releases, open-page releases or another app's caches.
        cleanup = await maintainStorage().catch(() => ({ removed: 0 }));
        if (cleanup.removed > 0) {
          await report('LAB_STORAGE_CLEANED', { removed: cleanup.removed });
          continue;
        }
      }
      await report('LAB_PACKAGE_ERROR', {
        code: quota ? 'storage-quota' : 'storage-write',
        message: quota ? 'Preglednik je odbio spremanje offline paketa zbog ograničenja prostora. ' + (cleanup?.blocked || 'Oslobodi prostor na uređaju pa ponovi preuzimanje.') : 'Paket nije spremljen u preglednik: ' + String(error?.message ?? error),
      });
      throw error;
    }
  }
}
self.addEventListener('install', event => {
  event.waitUntil(prepare());
  // Updates wait. Only an explicit, safely saved one-tab request skips waiting.
});
self.addEventListener('activate', event => {
  // Previous packages are retained. They can still serve an older tab's
  // content-addressed URLs; no user project or IndexedDB store is touched.
  event.waitUntil(self.clients.claim());
});
async function status() {
  const bytes = storedFiles.reduce((sum, file) => sum + file.bytes, 0);
  if (!(await caches.keys()).includes(CACHE)) return { ready: false, build: PACKAGE.build, version: PACKAGE.version, count: PACKAGE.files.length, bytes };
  const cache = await caches.open(CACHE);
  const keys = new Set((await cache.keys()).map(request => new URL(request.url).pathname));
  const ready = keys.has(MARKER) && storedFiles.every(file => keys.has(file.url));
  return { ready, build: PACKAGE.build, version: PACKAGE.version, count: PACKAGE.files.length, bytes };
}
self.addEventListener('message', event => {
  const reply = value => event.ports[0]?.postMessage(value);
  if (event.data?.type === 'LAB_STATUS') event.waitUntil(status().then(reply).catch(error => reply({ error: String(error) })));
  if (event.data?.type === 'LAB_STORAGE' || event.data?.type === 'LAB_CLEAN_STORAGE') event.waitUntil((async () => {
    if (!event.source?.id || !ownClient(event.source)) { reply({ error: 'Zahtjev mora doći iz otvorenog laboratorija.' }); return; }
    if (preparation) { reply({ error: 'Pričekaj završetak preuzimanja pa ponovno provjeri prostor.' }); return; }
    try {
      if (event.data.type === 'LAB_CLEAN_STORAGE') reply(await maintainStorage());
      else {
        const plan = await storagePlan();
        reply({ total: plan.total, removable: plan.removable.length, removed: 0, blocked: plan.blocked });
      }
    } catch { reply({ error: 'Pregled ili čišćenje paketa nije dovršeno. Projekti su sačuvani.' }); }
  })());
  if (event.data?.type === 'LAB_REPAIR') event.waitUntil(prepare().then(status).then(reply).catch(error => reply({ error: 'Paket nije ponovno preuzet. ' + String(error) })));
  if (event.data?.type === 'LAB_ACTIVATE') event.waitUntil((async () => {
    const windows = (await self.clients.matchAll({ type: 'window', includeUncontrolled: true })).filter(client => !client.url || new URL(client.url).pathname.startsWith(BASE));
    if (windows.length > 1) { reply({ error: 'Zatvori druge kartice ovog laboratorija pa ponovi ažuriranje.' }); return; }
    reply({ accepted: true });
    await self.skipWaiting();
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== origin || url.search) return;
  const path = url.pathname === BASE ? BASE + 'index.html' : url.pathname;
  const versioned = path.startsWith(BASE + 'app/') || path.startsWith(BASE + 'assets/');
  if (!urls.has(path) && !versioned) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(key(aliases[path] ?? path));
    // Clear the stored response URL for aliases so relative module imports
    // stay under the requested release URL, rather than the stable URL.
    if (cached) return aliases[path] ? new Response(cached.body, { status: cached.status, statusText: cached.statusText, headers: cached.headers }) : cached;
    if (versioned) {
      for (const name of await caches.keys()) {
        if (!name.startsWith(PREFIX) || name === CACHE) continue;
        const prior = await caches.open(name);
        let previous = await prior.match(key(path));
        if (!previous) {
          // Each retained release owns its mapping: never resolve an older
          // versioned URL against this release's stable runtime.
          try {
            const marker = await prior.match(key(MARKER));
            const target = (await marker?.json())?.aliases?.[path];
            if (typeof target === 'string' && target.startsWith(BASE) && !target.startsWith('//')) {
              const response = await prior.match(key(target));
              if (response) previous = new Response(response.body, { status: response.status, statusText: response.statusText, headers: response.headers });
            }
          } catch { /* Older releases have no alias map. */ }
        }
        if (previous) return previous;
      }
    }
    return fetch(request);
  })());
});
