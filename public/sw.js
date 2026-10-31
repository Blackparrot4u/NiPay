// NiPay service worker: after the first load the app shell runs with the internet off.
// Strategy: precache the shell, then cache every same-origin GET (hashed build assets) as it is used.
// API calls (/api/*) are never cached: payments and balances always come from the server.
const CACHE = 'nipay-shell-v2';
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icon.svg', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(SHELL);
    // also cache the hashed JS/CSS the shell points at, so the very first offline start works
    try {
      const html = await (await fetch('/index.html', { cache: 'no-store' })).text();
      const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1]);
      await Promise.all(assets.map((a) => c.add(a)));
    } catch (_) { /* dev server: no hashed assets */ }
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    if (req.mode === 'navigate') {
      try { const r = await fetch(req); if (r.ok) c.put('/index.html', r.clone()); return r; }
      catch (_) { return (await c.match('/index.html')) || (await c.match('/')) || Response.error(); }
    }
    const hit = await c.match(req);
    const refresh = fetch(req).then((r) => { if (r.ok) c.put(req, r.clone()); return r; }).catch(() => null);
    return hit || (await refresh) || Response.error();
  })());
});
