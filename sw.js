const CACHE_NAME = 'studio-verifier-v2';
const urlsToCache = [
  'studio-verifier.html',
  'styles/components.css',
  'scripts/studio-verifier.js',
  'manifest.json',
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      ),
      self.clients.claim(),
    ])
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Only handle GET requests (avoid interfering with form submits, etc.)
  if (req.method !== 'GET') return;

  // Only cache same-origin requests
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Only handle requests we explicitly precache. Avoid runtime caching of the whole site
  // (it can serve stale admin/auth JS and break login flows).
  const pathname = url.pathname.replace(/^\//, '');
  if (!urlsToCache.includes(pathname)) {
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => res);
    })
  );
});