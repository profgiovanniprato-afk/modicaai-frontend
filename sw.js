// ModicaAI Service Worker v4 — network-first per API live, cache-first per assets
const CACHE_STATIC = 'modicaai-static-v7';
const CACHE_API    = 'modicaai-api-v7';

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

  // API backend → SEMPRE network-first (dati live: carburanti, news, traffico)
  // Fallback cache solo se rete completamente offline
  if (url.includes('modicaai-api.onrender.com')) {
    // /ask, /ask-stream, /genera-immagine → sempre rete, mai cache
    if (url.includes('/ask') || url.includes('/genera-immagine') || url.includes('/session')) {
      return; // lascia passare normalmente
    }

    // /carburanti, /news, /traffico, /health → network-first con fallback cache
    e.respondWith(
      fetch(e.request)
        .then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_API).then(c => c.put(e.request, clone));
          }
          return res;
        })
        .catch(async () => {
          // Solo se rete non disponibile → usa cache
          const cached = await caches.match(e.request);
          return cached || new Response(
            JSON.stringify({ items: [], stazioni: [], segmenti: [], error: 'offline' }),
            { headers: { 'Content-Type': 'application/json' } }
          );
        })
    );
    return;
  }

  // Assets statici → cache-first
  if (e.request.method === 'GET') {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(res => {
          if (res.ok && !url.includes('chrome-extension')) {
            const clone = res.clone(); // clona PRIMA di return
            caches.open(CACHE_STATIC).then(c => c.put(e.request, clone));
          }
          return res;
        }).catch(() => caches.match('/index.html'));
      })
    );
  }
});

// ── Messaggi dal client ───────────────────────────────────────────
self.addEventListener('message', e => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});
