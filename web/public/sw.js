// eSkyTell service worker: cache-first for the static app shell, network for Firebase/Google APIs.
const CACHE = 'eskytell-v1';
const SCOPE = self.registration.scope;
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll([SCOPE, SCOPE + 'index.html', SCOPE + 'manifest.webmanifest', SCOPE + 'apple-touch-icon.png'])).catch(() => {}));
  self.skipWaiting();
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Firebase, Google sign-in, fonts from other origins: network only
  if (url.pathname.includes('/__/')) return; // Firebase auth helper paths
  if (req.mode === 'navigate') {
    // Network-first for the HTML so new deployments show up; fall back to cached shell offline.
    e.respondWith(fetch(req).then((r) => { const cp = r.clone(); caches.open(CACHE).then((c) => c.put(SCOPE + 'index.html', cp)); return r; })
      .catch(() => caches.match(SCOPE + 'index.html').then((r) => r || caches.match(SCOPE))));
    return;
  }
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((r) => {
    if (r.ok && (url.pathname.includes('/assets/') || url.pathname.includes('/icons/'))) { const cp = r.clone(); caches.open(CACHE).then((c) => c.put(req, cp)); }
    return r;
  })));
});
