// Minimal service worker: installable app, offline fallback for the shell.
// It never caches Supabase calls, photos, videos or messages (those are cross-origin).
const V = 'vybe-v1';
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(V).then((c) => c.addAll(['/', '/manifest.webmanifest', '/icon-192.png'])));
  self.skipWaiting();
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((x) => x !== V).map((x) => caches.delete(x)))));
  self.clients.claim();
});
self.addEventListener('fetch', (e) => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin) return;
  if (r.mode === 'navigate') { e.respondWith(fetch(r).catch(() => caches.match('/'))); return; }
  if (u.pathname.startsWith('/assets/')) {
    e.respondWith(caches.match(r).then((hit) => hit || fetch(r).then((res) => {
      const copy = res.clone(); caches.open(V).then((c) => c.put(r, copy)); return res;
    })));
  }
});
