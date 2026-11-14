const CACHE_NAME = 'listen-shell-v3';

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    const scope = self.registration.scope;
    const indexUrl = new URL('./index.html', scope).href;
    const coreUrls = [
      new URL('./', scope).href,
      indexUrl,
      new URL('./manifest.webmanifest', scope).href,
      new URL('./icons/icon-192.png', scope).href,
      new URL('./icons/icon-512.png', scope).href,
      new URL('./icons/listen-mark.svg', scope).href,
    ];
    await cache.addAll(coreUrls);

    // Production's HTML contains the hashed Vite JS/CSS filenames. Cache them during
    // installation so Listen can actually open offline on its very first relaunch.
    const htmlResponse = await cache.match(indexUrl);
    const html = await htmlResponse.text();
    const assetRefs = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)]
      .map((match) => match[1])
      .filter((path) => /\.(?:js|css)(?:[?#].*)?$/i.test(path));
    for (const reference of assetRefs) {
      try {
        const url = new URL(reference, indexUrl);
        if (url.origin !== new URL(scope).origin || !url.href.startsWith(scope)) continue;
        const response = await fetch(url.href, { cache: 'reload' });
        if (response.ok) await cache.put(url.href, response.clone());
      } catch { /* A dev-server-only asset should not prevent the PWA from installing. */ }
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith('listen-shell-') && key !== CACHE_NAME).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const scopeUrl = new URL(self.registration.scope);
  if (url.origin !== scopeUrl.origin || !url.href.startsWith(scopeUrl.href)) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    if (request.mode === 'navigate') {
      try {
        const response = await fetch(request);
        if (response.ok) {
          cache.put(request, response.clone());
          cache.put(new URL('./index.html', scopeUrl).href, response.clone());
        }
        return response;
      } catch {
        return (await cache.match(request)) || (await cache.match(new URL('./index.html', scopeUrl).href));
      }
    }

    const cached = await cache.match(request);
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response.ok && response.type !== 'opaque') cache.put(request, response.clone());
      return response;
    } catch {
      return new Response('', { status: 504, statusText: 'Offline and not cached' });
    }
  })());
});
