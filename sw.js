// ModicaAI Service Worker v5
// ─────────────────────────────────────────────────────────────────
// STRATEGIA:
//   • Pagine HTML     → NETWORK-FIRST  (sempre contenuto fresco)
//   • Asset statici   → CACHE-FIRST    (icone, manifest, font)
//   • API /ask        → BYPASS         (mai cacheate)
//   • API /carburanti /news → NETWORK-FIRST con fallback offline
//
// AGGIORNAMENTO: prima di ogni push eseguire:
//   python3 bump_version.py
// Il cambio di CACHE_VERSION invalida tutta la cache vecchia e
// ricarica automaticamente tutti i tab e l'app installata.
// ─────────────────────────────────────────────────────────────────
const CACHE_VERSION = 'modicaai-v20260328-1500';
const CACHE_STATIC  = `modicaai-static-${CACHE_VERSION}`;
const CACHE_API     = `modicaai-api-${CACHE_VERSION}`;

// Solo asset statici in precache — le pagine HTML restano sempre fresche
const STATIC_ASSETS = [
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

// ── Install: precache asset statici ──────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_STATIC)
      .then(c => Promise.allSettled(
        STATIC_ASSETS.map(url => c.add(url).catch(() => {}))
      ))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: elimina cache vecchie e notifica tutti i tab ───────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => k !== CACHE_STATIC && k !== CACHE_API)
          .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll({ type: 'window', includeUncontrolled: true }))
      .then(clients => {
        // Invia messaggio a tutti i tab → index.html ricarica automaticamente
        clients.forEach(client =>
          client.postMessage({ type: 'SW_UPDATED', version: CACHE_VERSION })
        );
      })
  );
});

// ── Fetch: strategia adattiva per tipo di risorsa ────────────────
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  const url = e.request.url;
  let parsed;
  try { parsed = new URL(url); } catch { return; }
  const { hostname, pathname } = parsed;

  // ── API backend → strategia specifica per endpoint ──────────────
  if (hostname === 'modicaai-api.onrender.com') {
    // Endpoint conversazionali → sempre rete, MAI cache
    if (
      pathname.includes('/ask') ||
      pathname.includes('/genera-immagine') ||
      pathname.includes('/session') ||
      pathname.includes('/kb-reload')
    ) {
      return; // bypass: il browser gestisce la richiesta normalmente
    }

    // Endpoint dati live (carburanti, news, traffico, health, meteo)
    // → network-first con fallback cache offline
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
          const cached = await caches.match(e.request);
          return cached || new Response(
            JSON.stringify({ items: [], stazioni: [], segmenti: [], error: 'offline' }),
            { headers: { 'Content-Type': 'application/json' } }
          );
        })
    );
    return;
  }

  // ── Pagine HTML → NETWORK-FIRST (sempre aggiornate) ──────────────
  if (pathname === '/' || pathname.endsWith('.html')) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          if (res.ok) {
            // Salva in cache come backup offline
            const clone = res.clone();
            caches.open(CACHE_STATIC).then(c => c.put(e.request, clone));
          }
          return res;
        })
        .catch(async () => {
          // Rete non disponibile: usa versione cached
          const cached = await caches.match(e.request);
          return cached || caches.match('/index.html');
        })
    );
    return;
  }

  // ── Asset statici (icone, manifest, font, script) → CACHE-FIRST ──
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res.ok && !url.includes('chrome-extension')) {
          const clone = res.clone();
          caches.open(CACHE_STATIC).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => caches.match('/index.html'));
    })
  );
});

// ── Messaggi dal client ───────────────────────────────────────────
self.addEventListener('message', e => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});
