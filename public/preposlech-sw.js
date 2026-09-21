/*
 * AUDIOTAGGER OFFLINE (zadání 21. 9. 2026: „bylo by super přidat možnost, aby
 * mohl klient v AudioTaggeru pracovat offline, když bude vědět, že bude mimo
 * signál").
 *
 * Tenhle service worker hlídá JEN stránky klientského odkazu (/preposlech/…),
 * portálu se nedotkne - ten má svůj /sw.js na upozornění.
 *
 * Co dělá:
 *  - stránku odkazu, skripty a styly Next.js a odpovědi API přeposlechu (seznam
 *    stop, poznámky, záložka) si při každém načtení se signálem uloží, a když
 *    signál není, vrátí uloženou verzi. Díky tomu se odkaz otevře i offline.
 *  - SAMOTNÉ NAHRÁVKY A TEXT neřeší: ty si stránka stáhne sama tlačítkem
 *    „Na cestu" do stejné cache a přehrává je odtud (viz lib/preposlechOffline).
 *  - zápisy (poznámky, záložka) nepouští - frontu na ně drží stránka a odešle
 *    je, až se signál vrátí.
 *
 * Vždycky nejdřív síť: se signálem se chová, jako by tu nebyl.
 */
const CACHE = 'ms-preposlech-offline-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

function smiUlozit(url, request) {
  if (request.method !== 'GET') return false;
  if (url.origin !== self.location.origin) return false;
  // Nahravky a PDF uklada stranka sama a cele - tady by sly po kouscich
  // (Range) a do cache by se dostala jen cast.
  if (url.pathname.endsWith('/preposlech/soubor')) return false;
  if (request.headers.has('range')) return false;
  return (
    request.mode === 'navigate' ||
    url.pathname.startsWith('/_next/static/') ||
    (url.pathname.startsWith('/api/projekty/') && url.pathname.includes('/preposlech')) ||
    /\.(png|svg|gif|ico|woff2?)$/.test(url.pathname)
  );
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Nahravka nebo text stazeny na cestu - odtud, i se signalem (je to rychlejsi).
  if (request.method === 'GET' && url.pathname.endsWith('/preposlech/soubor') && !request.headers.has('range')) {
    event.respondWith(
      caches.open(CACHE).then((cache) =>
        cache.match(request).then((ulozeno) => ulozeno || fetch(request)),
      ),
    );
    return;
  }

  if (!smiUlozit(url, request)) return;

  // Skripty Next.js se nemeni (maji v nazvu otisk) - z cache, kdyz tam jsou.
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.open(CACHE).then((cache) =>
        cache.match(request).then(
          (ulozeno) =>
            ulozeno ||
            fetch(request).then((odpoved) => {
              if (odpoved.ok) cache.put(request, odpoved.clone()).catch(() => {});
              return odpoved;
            }),
        ),
      ),
    );
    return;
  }

  // Ostatni: sit, a kdyz neni, posledni ulozena verze.
  event.respondWith(
    fetch(request)
      .then((odpoved) => {
        if (odpoved.ok) {
          const kopie = odpoved.clone();
          caches.open(CACHE).then((cache) => cache.put(request, kopie)).catch(() => {});
        }
        return odpoved;
      })
      .catch(() =>
        caches.open(CACHE).then((cache) =>
          cache.match(request).then(
            (ulozeno) =>
              ulozeno ||
              new Response(JSON.stringify({ error: 'Jste offline.' }), {
                status: 503,
                headers: { 'Content-Type': 'application/json' },
              }),
          ),
        ),
      ),
  );
});
