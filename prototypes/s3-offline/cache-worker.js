const prefix = 'labos-s3-pilot-' + self.registration.scope + '-';
const name = prefix + version;
self.addEventListener('install', event => event.waitUntil((async () => {
  const cache = await caches.open(name);
  try {
    for (const [path, digest] of Object.entries(sums)) {
      const response = await fetch(path, {cache: 'reload'});
      if (!response.ok) throw Error(path);
      const body = await response.arrayBuffer();
      const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', body));
      if (Array.from(hash, n => n.toString(16).padStart(2,'0')).join('') !== digest) throw Error(path);
      await cache.put(path, new Response(body, {headers: {'Content-Type': response.headers.get('Content-Type') || 'application/octet-stream'}}));
    }
    await self.skipWaiting();
  } catch (error) {
    await caches.delete(name);
    throw error;
  }
})()));
self.addEventListener('activate', event => event.waitUntil((async () => {
  await self.clients.claim();
  for (const key of await caches.keys()) if (key.startsWith(prefix) && key !== name) await caches.delete(key);
})()));
self.addEventListener('fetch', event => {
  const url = event.request.url;
  if (!url.startsWith(self.registration.scope)) return;
  const path = url.slice(self.registration.scope.length) || 'index.html';
  if (Object.hasOwn(sums,path)) event.respondWith(caches.open(name).then(cache => cache.match(path)));
});
