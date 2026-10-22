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

/** Z odkazu v upozorneni vytahne, ktere konverzace se tyka. */
function konverzaceZOdkazu(odkaz) {
  const kde = String(odkaz || '').indexOf('konverzace=');
  if (kde < 0) return null;
  return decodeURIComponent(String(odkaz).slice(kde + 'konverzace='.length).split('&')[0]) || null;
}

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

  /*
   * OTEVRENE OKNO SE DOZVI HNED (zadani Petra Dratvy 21. 10. 2026: „sprava na
   * desktop app sa zobrazi asi 5-10 sekund neskor, ako pride notifikacia na
   * mobile"). Upozorneni dorazi okamzite, kdezto stranka se ptala az pri
   * dalsim kole dotazu - tak jí to rekneme rovnou.
   */
  const konverzace = konverzaceZOdkazu(nastaveni.data.odkaz);

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(titulek, nastaveni),
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((okna) => {
        okna.forEach((okno) => {
          if ('postMessage' in okno) okno.postMessage({ typ: 'nova-zprava', konverzace });
        });
      }),
    ]),
  );
});

/**
 * Klepnutí na upozornění vede DO TÉ KONVERZACE, ze které přišlo
 * (zadání 14. 9. 2026: „když mi přijde na mobilu notifikace a kliknu na ni,
 * potřeboval bych se dostat rovnou na konverzaci té notifikace").
 *
 * Dřív se jen přepnulo do už otevřeného okna chatu - a to ukazovalo tu
 * konverzaci, ve které člověk zrovna byl. Na telefonu, kde je aplikace
 * otevřená pořád, tím upozornění skončilo vždycky jinde, než kam volalo.
 *
 * Otevřenému chatu se proto pošle zpráva, kterou konverzaci ukázat — otevře
 * ji sám a stránka se nenačítá znovu, takže rozepsaná zpráva zůstane
 * rozepsaná. Když je okno jinde v portálu, přejde na adresu z upozornění.
 */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const odkaz = (event.notification.data && event.notification.data.odkaz) || '/chat';
  const konverzace = konverzaceZOdkazu(odkaz);

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (okna) => {
      const okno = okna.find((o) => o.url.includes('/chat')) || okna[0];
      if (!okno) return self.clients.openWindow(odkaz);

      if ('focus' in okno) await okno.focus();

      // Chat uz je otevreny: staci mu rict, kterou konverzaci ukazat. Stranka
      // se nenacita znovu, takze rozepsana zprava zustane rozepsana.
      if (konverzace && okno.url.includes('/chat') && 'postMessage' in okno) {
        okno.postMessage({ typ: 'otevri-konverzaci', konverzace });
        return undefined;
      }

      // Okno je jinde v portalu - prejdeme na adresu z upozorneni.
      if ('navigate' in okno) {
        try {
          await okno.navigate(odkaz);
          return undefined;
        } catch (err) {
          // Starsi prohlizec navigate neumi - otevreme rovnou nove okno.
        }
      }
      return self.clients.openWindow(odkaz);
    }),
  );
});
