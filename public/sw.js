/*! FinTax service worker: keeps the app shell available offline. API calls and client files are never cached. */
const CACHE = 'fintax-shell-v1';
const SHELL = ['./', 'index.html', 'css/app.css', 'core/core.js', 'core/seed.js', 'js/icons.js', 'js/lib.js', 'js/ui.js', 'js/main.js', 'js/site.js', 'js/admin.js', 'js/app.js', 'js/app2.js', 'js/portal.js', 'js/boot.js', 'icons/icon-192.png', 'icons/icon-512.png'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    if (url.pathname.indexOf('/api/') >= 0 || url.pathname.endsWith('manifest.webmanifest') || url.pathname.indexOf('/brand/') >= 0) return;
    if (req.mode === 'navigate') {
      e.respondWith(fetch(req).then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put('index.html', copy)); return r; }).catch(() => caches.match('index.html')));
      return;
    }
    e.respondWith(caches.match(req).then((hit) => {
      const net = fetch(req).then((r) => { if (r && r.ok) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); } return r; }).catch(() => hit);
      return hit || net;
    }));
    return;
  }
  if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); return r; })));
  }
});
