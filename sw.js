// ModicaAI Service Worker v9 — network-first HTML, cache-first assets
// Incrementa la versione ad ogni deploy per forzare aggiornamento su tutti i device
const CACHE_VERSION = 'v9';
const CACHE_STATIC  = 'modicaai-static-' + CACHE_VERSION;
const CACHE_API     = 'modicaai-api-'    + CACHE_VERSION;

// Asset statici da pre-cachare (solo quelli essenziali)
const STATIC_ASSETS = [
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
];

// Pagine HTML del sito
const HTML_PAGES = [
  '/',
  '/index.html',
  '/news.html',
  '/gioco.html',
  '/mappa.html',
  '/mission.html',
  '/contatti.html',
  '/cioccolato.html',
  '/cosa-vedere.html',
  '/come-arrivare.html',
  '/gastronomia.html',
  '/guida-pratica.html',
  '/storia.html',
  '/dintorni.html',
  '/faq.html',
];

// ── Install: pre-cache assets statici ──────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_STATIC).then(c => {
      return Promise.allSettled(
        STATIC_ASSETS.map(url => c.add(url).catch(() => {}))
      );
    }).then(() => self.skipWaiting()) // attiva subito senza aspettare chiusura tab
  );
});

// ── Activate: elimina TUTTE le cache vecchie ───────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_STATIC && k !== CACHE_API)
          .map(k => {
            console.log('[SW] Elimino cache obsoleta:', k);
            return caches.delete(k);
          })
      )
    ).then(() => self.clients.claim()) // prende controllo di tutti i client aperti
  );
});

// ── Fetch: strategia adattiva per tipo di risorsa ──────────────────
self.addEventListener('fetch', e => {
  const url  = new URL(e.request.url);
  const href = e.request.url;

  // Ignora richieste non-GET
  if (e.request.method !== 'GET') return;

  // Ignora chrome-extension e altri schemi non-http
  if (!href.startsWith('http')) return;

  // ── 1. API backend → SEMPRE network-first ──────────────────────
  if (href.includes('modicaai-api.onrender.com') || href.includes('modicaai-api.koyeb.app')) {
    // Route AI/streaming/sessioni → mai cache
    if (href.includes('/ask') || href.includes('/genera-immagine') ||
        href.includes('/session') || href.includes('/ottimizza-prompt') ||
        href.includes('/analizza-file') || href.includes('/genera-documento')) {
      return; // passa direttamente alla rete
    }
    // Dati live con fallback cache
    e.respondWith(
      fetch(e.request, { credentials: 'omit' })
        .then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_API).then(c => c.put(e.request, clone));
          }
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(e.request);
          return cached || new Response(
            JSON.stringify({ items: [], stazioni: [], segmenti: [], error: 'offline' }),
            { headers: { 'Content-Type': 'application/json' } }
          );
        })
    );
    return;
  }

  // ── 2. Pagine HTML → NETWORK-FIRST (sempre contenuto fresco) ───
  const isHTML = url.pathname === '/' ||
                 url.pathname.endsWith('.html') ||
                 e.request.headers.get('accept')?.includes('text/html');

  if (isHTML) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          if (res.ok) {
            // Aggiorna cache con versione fresca
            const clone = res.clone();
            caches.open(CACHE_STATIC).then(c => c.put(e.request, clone));
          }
          return res;
        })
        .catch(async () => {
          // Offline → usa cache se disponibile
          const cached = await caches.match(e.request);
          if (cached) return cached;
          // Ultima risorsa → index.html
          return caches.match('/index.html') ||
                 new Response('<h1>ModicaAI — Offline</h1><p>Connettiti a internet per usare ModicaAI.</p>',
                   { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
        })
    );
    return;
  }

  // ── 3. Font Google / CDN esterni → cache-first con timeout ────
  if (href.includes('fonts.googleapis.com') || href.includes('fonts.gstatic.com') ||
      href.includes('cdnjs.cloudflare.com') || href.includes('unpkg.com')) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_STATIC).then(c => c.put(e.request, clone));
          }
          return res;
        }).catch(() => cached);
      })
    );
    return;
  }

  // ── 4. Assets statici (icone, manifest, splash) → cache-first ──
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res.ok && !href.includes('chrome-extension')) {
          const clone = res.clone();
          caches.open(CACHE_STATIC).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => caches.match('/index.html'));
    })
  );
});

// ── Messaggi dal client (forza skipWaiting) ─────────────────────────
self.addEventListener('message', e => {
  if (e.data === 'skipWaiting') {
    self.skipWaiting();
  }
  if (e.data === 'clearCache') {
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))));
  }
});
