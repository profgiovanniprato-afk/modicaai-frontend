// ModicaAI Service Worker v3 — cache-first per assets, network-first per API
const CACHE_STATIC = 'modicaai-static-v3';
const CACHE_API    = 'modicaai-api-v3';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

// ── Install: precache risorse statiche ────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_STATIC).then(c => {
      return Promise.allSettled(
        STATIC_ASSETS.map(url => c.add(url).catch(() => {}))
      );
    }).then(() => self.skipWaiting())
  );
});

// ── Activate: pulisce cache vecchie ──────────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_STATIC && k !== CACHE_API)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: strategia adattiva ────────────────────────────────────
self.addEventListener('fetch', e => {
  const url = e.request.url;

  // API backend → network-first con fallback offline
  if (url.includes('modicaai-api.onrender.com')) {
    // Per /carburanti e /news: stale-while-revalidate (risposta veloce + aggiorna)
    if (url.includes('/carburanti') || url.includes('/news')) {
      e.respondWith(
        caches.open(CACHE_API).then(async cache => {
          const cached = await cache.match(e.request);
          const fetchPromise = fetch(e.request).then(res => {
            if (res.ok) cache.put(e.request, res.clone());
            return res;
          }).catch(() => null);
          return cached || fetchPromise ||
            new Response(JSON.stringify({items:[], stazioni:[], error:'offline'}),
              {headers:{'Content-Type':'application/json'}});
        })
      );
    }
    // Altre route API (/ask, /genera-immagine): sempre network
    return;
  }

  // Assets statici → cache-first
  if (e.request.method === 'GET') {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(res => {
          if (res.ok && !url.includes('chrome-extension')) {
            caches.open(CACHE_STATIC).then(c => c.put(e.request, res.clone()));
          }
          return res;
        }).catch(() => caches.match('/index.html'));
      })
    );
  }
});

// ── Background Sync: notifica aggiornamenti ───────────────────────
self.addEventListener('message', e => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});
