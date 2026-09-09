/*
 * Service worker MS Portalu a MS Chatu (zadání 9. 9. 2026).
 *
 * Do mezipaměti se nic neukládá - portál pracuje se živými daty a stará
 * odpověď by napáchala víc škody než užitku. Service worker tu je ze dvou
 * důvodů: bez něj prohlížeč aplikaci nenabídne k instalaci na plochu,
 * a hlavně sem chodí upozornění na nové zprávy.
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

/* --------------------------------------------------------------------------
   Upozornění na nové zprávy
-------------------------------------------------------------------------- */

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (err) {
    // Balíček v jiném tvaru, než čekáme - ukážeme aspoň obecné upozornění.
    data = {};
  }

  const titulek = data.titulek || 'MS Chat';
  const nastaveni = {
    body: data.text || 'Nová zpráva',
    icon: '/ikony/chat-192.png',
    badge: '/ikony/chat-192.png',
    // Stejná značka = nové upozornění přepíše předchozí ze stejné
    // konverzace, aby se na zamčené obrazovce nekupil sloupec hlášek.
    tag: data.znacka || 'ms-chat',
    renotify: true,
    data: { odkaz: data.odkaz || '/chat' },
  };

  event.waitUntil(self.registration.showNotification(titulek, nastaveni));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const odkaz = (event.notification.data && event.notification.data.odkaz) || '/chat';

  // Když už je chat někde otevřený, přepneme se do něj místo otevírání
  // dalšího okna - jinak by po pár upozorněních měl člověk plochu plnou
  // stejných oken.
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((okna) => {
      for (const okno of okna) {
        if (okno.url.includes('/chat') && 'focus' in okno) return okno.focus();
      }
      return self.clients.openWindow(odkaz);
    }),
  );
});
