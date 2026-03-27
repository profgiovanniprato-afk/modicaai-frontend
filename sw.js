// ─────────────────────────────────────────────────────────────────────────────
// ModicaAI — Service Worker
// Aggiorna CACHE_VERSION ad ogni deploy per forzare il refresh su tutti i client.
// Lo script Python bump_version.py lo aggiorna automaticamente.
// ─────────────────────────────────────────────────────────────────────────────

const CACHE_VERSION = 'modicaai-v1';

// Asset da mettere in cache al primo install (shell dell'app)
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/news.html',
  '/gioco.html',
  '/mission.html',
  '/cioccolato.html',
  '/cosa-vedere.html',
  '/come-arrivare.html',
  '/gastronomia.html',
  '/storia.html',
  '/dintorni.html',
  '/faq.html',
  '/guida-pratica.html',
  '/contatti.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
];

// ── INSTALL: scarica e metti in cache tutti gli asset della shell ──────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())  // attiva subito senza aspettare chiusura tab
  );
});

// ── ACTIVATE: elimina tutte le cache vecchie ──────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_VERSION)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())  // prende controllo di tutti i tab aperti
  );
});

// ── FETCH: Network-first per HTML, Cache-first per asset statici ───────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Ignora richieste non-GET e chiamate API esterne
  if (event.request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;

  // Per le chiamate all'API Render: sempre network, mai cache
  if (url.hostname.includes('onrender.com')) return;

  // Strategia Network-first per i file HTML
  if (event.request.headers.get('accept')?.includes('text/html') ||
      url.pathname.endsWith('.html') || url.pathname === '/') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Aggiorna la cache con la versione fresca
          const clone = response.clone();
          caches.open(CACHE_VERSION).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request)) // fallback offline
    );
    return;
  }

  // Strategia Cache-first per tutti gli altri asset (icone, manifest, ecc.)
  event.respondWith(
    caches.match(event.request)
      .then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          const clone = response.clone();
          caches.open(CACHE_VERSION).then(cache => cache.put(event.request, clone));
          return response;
        });
      })
  );
});

// ── MESSAGGI: skipWaiting su richiesta del frontend ───────────────────────
self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});
