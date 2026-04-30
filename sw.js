// Service Worker for offline-first PWA
// Bump CACHE_VERSION on each release to trigger cache refresh on clients
const CACHE_VERSION = 'v2-firebase';
const CACHE = `autoservice-${CACHE_VERSION}`;

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg',
];

// Cache static assets from these CDNs (fonts + Firebase SDK).
// Firestore data calls (firestore.googleapis.com) are NOT cached — go to network.
const CDN_HOSTS = /^https:\/\/(fonts\.(googleapis|gstatic)\.com|www\.gstatic\.com\/firebasejs)\//;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  // For navigations: try network first to get latest; fall back to cached shell
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((resp) => {
          const clone = resp.clone();
          caches.open(CACHE).then((c) => c.put('./index.html', clone));
          return resp;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Cache-first for everything else (assets + fonts)
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((resp) => {
        if (resp.ok && (req.url.startsWith(self.location.origin) || CDN_HOSTS.test(req.url))) {
          const clone = resp.clone();
          caches.open(CACHE).then((c) => c.put(req, clone));
        }
        return resp;
      }).catch(() => undefined);
    })
  );
});
