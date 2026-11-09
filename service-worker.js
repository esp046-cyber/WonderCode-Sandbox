const V = 'wcs-v9';
const ASSETS = [
  './',
  'index.html',
  'offline.html',
  'style.css',
  'app.js',
  'js/db.js',
  'js/validator.js',
  'js/templates.js',
  'js/tag-converter.js',
  'js/editor.js',
  'sw-register.js',
  'manifest.webmanifest',
  'icons/favicon.svg',
  'icons/icon.svg',
  'icons/icon-192.svg',
  'icons/icon-512.svg',
  'icons/icon-maskable-192.svg',
  'icons/icon-maskable-512.svg',
  'icons/screenshot-wide.svg',
  'icons/screenshot-narrow.svg',
  '404.html',
  'privacy.html',
  'terms.html'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(V).then((c) => c.addAll(ASSETS))
  );
});

self.addEventListener('message', (e) => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== V).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then((hit) => {
      const net = fetch(e.request)
        .then((r) => {
          if (r.status === 200) {
            const copy = r.clone();
            caches.open(V).then((c) => c.put(e.request, copy));
          }
          return r;
        })
        .catch(() => hit || caches.match('offline.html'));
      return hit || net;
    })
  );
});
