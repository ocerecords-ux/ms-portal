/*
 * Service worker MS Portalu a MS Chatu (zadání 9. 9. 2026).
 *
 * Zatím dělá jen dvě věci: hlásí se o slovo hned po instalaci (bez čekání na
 * zavření všech oken) a pouští požadavky beze změny dál. Nic se neukládá do
 * mezipaměti - portál pracuje se živými daty a stará odpověď v mezipaměti by
 * napáchala víc škody než užitku.
 *
 * Existovat ale musí: bez service workeru prohlížeč aplikaci nenabídne
 * k instalaci na plochu. A až přibudou upozornění na nové zprávy, budou
 * chodit právě sem.
 */

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Bez fetch obsluhy by prohlížeč aplikaci nepovažoval za instalovatelnou.
self.addEventListener('fetch', () => {
  // Schválně prázdné - požadavek jde na síť jako obvykle.
});
