/**
 * AUDIOTAGGER OFFLINE - strana prohlížeče (zadání 21. 9. 2026: „bylo by super
 * přidat možnost, aby mohl klient v AudioTaggeru pracovat offline, když bude
 * vědět, že bude mimo signál").
 *
 * Jak to funguje:
 *  1. Klient před cestou klepne na „Na cestu". Stránka stáhne CELÉ nahrávky
 *     a text do Cache Storage prohlížeče (stejná cache, kterou čte
 *     public/preposlech-sw.js), a uloží i samotnou stránku se skripty, aby se
 *     odkaz otevřel i bez signálu.
 *  2. Nahrávka, která je stažená, se přehrává z počítače (blob), text se
 *     otevírá z počítače. Se signálem i bez něj - je to tak i rychlejší.
 *  3. Co klient bez signálu zapíše (poznámky, úpravy, záložka, přeposlechnuto),
 *     čeká ve FRONTĚ v localStorage a odejde samo, jakmile je signál zpátky.
 *
 * Nic z toho neběží na serveru - soubor se používá jen v prohlížeči.
 */

export const CACHE_OFFLINE = 'ms-preposlech-offline-v1';

function maCache(): boolean {
  return typeof window !== 'undefined' && 'caches' in window;
}

/** Plná adresa - v cache se klíče ukládají celé. */
function plna(url: string): string {
  return new URL(url, window.location.origin).toString();
}

/** Které z adres už jsou stažené na cestu. */
export async function stazeneAdresy(urls: string[]): Promise<Set<string>> {
  const vysledek = new Set<string>();
  if (!maCache()) return vysledek;
  try {
    const cache = await caches.open(CACHE_OFFLINE);
    for (const u of urls) {
      if (await cache.match(plna(u))) vysledek.add(u);
    }
  } catch {
    // Prohlizec cache nedovoli (anonymni okno apod.) - offline proste neni.
  }
  return vysledek;
}

/**
 * Stáhne soubory na cestu. Po každém souboru zavolá `prubeh`. Soubor, který
 * už stažený je, se nestahuje znovu.
 */
export async function stahniNaCestu(
  urls: string[],
  prubeh: (hotovo: number, celkem: number, bajtu: number) => void,
): Promise<{ ok: boolean; chyba?: string }> {
  if (!maCache()) return { ok: false, chyba: 'Tenhle prohlížeč neumí ukládat soubory pro offline.' };
  try {
    // Prohlizec pak soubory sam od sebe nesmaze, kdyz dochazi misto.
    await navigator.storage?.persist?.().catch(() => false);
    const cache = await caches.open(CACHE_OFFLINE);
    let bajtu = 0;
    for (let i = 0; i < urls.length; i += 1) {
      const klic = plna(urls[i]);
      const uz = await cache.match(klic);
      if (!uz) {
        const odpoved = await fetch(klic, { cache: 'no-store' });
        if (!odpoved.ok) return { ok: false, chyba: `Soubor ${i + 1} se nepodařilo stáhnout.` };
        const blob = await odpoved.blob();
        bajtu += blob.size;
        await cache.put(
          klic,
          new Response(blob, {
            headers: {
              'Content-Type': odpoved.headers.get('Content-Type') || 'application/octet-stream',
              'Content-Length': String(blob.size),
            },
          }),
        );
      }
      prubeh(i + 1, urls.length, bajtu);
    }
    await ulozStrankuProOffline(cache);
    return { ok: true };
  } catch (err) {
    const plno = err instanceof DOMException && err.name === 'QuotaExceededError';
    return {
      ok: false,
      chyba: plno ? 'V prohlížeči už není místo. Uvolněte místo na disku a zkuste to znovu.' : 'Stahování se přerušilo.',
    };
  }
}

/**
 * Stránka odkazu a všechno, co k ní prohlížeč načetl (skripty, styly,
 * písma) - aby se odkaz otevřel i bez signálu. Service worker to pak bere
 * z téže cache.
 */
async function ulozStrankuProOffline(cache: Cache) {
  const adresy = new Set<string>([window.location.href]);
  for (const zaznam of performance.getEntriesByType('resource')) {
    const u = new URL(zaznam.name);
    if (u.origin !== window.location.origin) continue;
    if (u.pathname.startsWith('/_next/static/') || /\.(png|svg|gif|ico|woff2?)$/.test(u.pathname)) adresy.add(u.toString());
  }
  for (const a of Array.from(adresy)) {
    try {
      if (await cache.match(a)) continue;
      const odpoved = await fetch(a);
      if (odpoved.ok) await cache.put(a, odpoved);
    } catch {
      // Jeden chybejici obrazek nevadi.
    }
  }
}

/** Smaže stažené soubory z počítače. */
export async function smazZCesty(urls: string[]): Promise<void> {
  if (!maCache()) return;
  try {
    const cache = await caches.open(CACHE_OFFLINE);
    for (const u of urls) await cache.delete(plna(u));
  } catch {
    // nic
  }
}

/** Stažený soubor jako blob, nebo null. */
export async function blobZCesty(url: string): Promise<Blob | null> {
  if (!maCache()) return null;
  try {
    const cache = await caches.open(CACHE_OFFLINE);
    const odpoved = await cache.match(plna(url));
    return odpoved ? await odpoved.blob() : null;
  } catch {
    return null;
  }
}

/** Zaregistruje service worker klientského odkazu (jen /preposlech/…). */
export function zaregistrujOfflineWorker() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('/preposlech-sw.js', { scope: '/preposlech/' }).catch((err) => {
    console.warn('Offline pro přeposlech se nepodařilo zapnout:', err);
  });
}

/* ---------- fronta zápisů bez signálu ---------- */

export type ZapisVeFronte = {
  /** Náhodné ID - podle něj se zápis z fronty maže. */
  id: string;
  url: string;
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: string;
  /**
   * Zápis, který přepisuje předchozí stejného druhu (záložka jedné stopy) -
   * ve frontě pak zůstane jen poslední.
   */
  klic?: string;
  /** U nové poznámky: dočasné ID, pod kterým ji zatím ukazujeme. */
  docasneId?: string;
  kdy: string;
};

const klicFronty = (projekt: string) => `ms-preposlech-fronta:${projekt}`;

export function nactiFrontu(projekt: string): ZapisVeFronte[] {
  try {
    const t = window.localStorage.getItem(klicFronty(projekt));
    const f = t ? (JSON.parse(t) as ZapisVeFronte[]) : [];
    return Array.isArray(f) ? f : [];
  } catch {
    return [];
  }
}

export function ulozFrontu(projekt: string, fronta: ZapisVeFronte[]) {
  try {
    if (fronta.length === 0) window.localStorage.removeItem(klicFronty(projekt));
    else window.localStorage.setItem(klicFronty(projekt), JSON.stringify(fronta));
  } catch {
    // Plne nebo zakazane uloziste - zapis zustane jen v pameti.
  }
}

export function novyZapis(z: Omit<ZapisVeFronte, 'id' | 'kdy'>): ZapisVeFronte {
  return { ...z, id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`, kdy: new Date().toISOString() };
}

/** Selhalo to kvůli síti (ne kvůli tomu, že server řekl ne)? */
export function jeChybaSite(err: unknown): boolean {
  return err instanceof TypeError || (typeof navigator !== 'undefined' && navigator.onLine === false);
}
