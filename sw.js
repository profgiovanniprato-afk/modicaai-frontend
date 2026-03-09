const CACHE = 'modicaai-v1';
const ASSETS = ['/', '/index.html'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
});

self.addEventListener('fetch', e => {
  if (e.request.url.includes('modicaai-api.onrender.com')) return;
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});
