import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { zakladPortalu } from '@/lib/preposlechOdkaz';

/**
 * INSTAGRAM NA TABULÍCH VE STUDIÍCH (zadání 22. 9. 2026: „můžeme propojit tu
 * tabuli ve studiu s účtem na Instagramu? Že by se tam promítaly i příběhy
 * v nějakém okně" → „pojďme ho tam dát").
 *
 * Používá se oficiální „Instagram API s přihlášením přes Instagram" (Meta).
 * Potřebuje firemní nebo tvůrčí účet a aplikaci v Meta for Developers:
 *   INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET v nastavení Vercelu,
 *   přesměrování: <portál>/api/admin/instagram/navrat.
 * Pak se v Administraci → Studia klikne „Připojit Instagram" a jednou se
 * přihlásí. Token platí 60 dní a portál ho sám prodlouží, když se blíží konec.
 *
 * Tabule se ptá každých 30 s, Instagram ale portál volá nejvýš jednou za
 * 10 minut - výsledek se drží v InstagramUcet.cache.
 */

const API = 'https://graph.instagram.com';
const VERZE = 'v23.0';
const CACHE_MS = 10 * 60_000;
const PRODLOUZIT_PRED_MS = 15 * 24 * 3600_000;

export type PolozkaInstagramu = {
  id: string;
  typ: 'IMAGE' | 'VIDEO';
  url: string;
  nahled: string | null;
  kdy: string;
};

export type InstagramNaTabuli = {
  ucet: string | null;
  /** „pribehy" = aktivní příběhy (24 h), „prispevky" = když příběh není. */
  druh: 'pribehy' | 'prispevky';
  polozky: PolozkaInstagramu[];
};

export function instagramNastaven(): boolean {
  return Boolean(process.env.INSTAGRAM_APP_ID && process.env.INSTAGRAM_APP_SECRET);
}

export function adresaNavratu(): string {
  return `${zakladPortalu()}/api/admin/instagram/navrat`;
}

export function odkazPrihlaseni(state: string): string {
  const p = new URLSearchParams({
    enable_fb_login: '0',
    force_authentication: '1',
    client_id: process.env.INSTAGRAM_APP_ID || '',
    redirect_uri: adresaNavratu(),
    response_type: 'code',
    scope: 'instagram_business_basic',
    state,
  });
  return `https://www.instagram.com/oauth/authorize?${p.toString()}`;
}

/** Kód z přihlášení → dlouhodobý token, uloží se. */
export async function pripojUcet(kod: string): Promise<{ ok: true; username: string | null } | { ok: false; chyba: string }> {
  const telo = new URLSearchParams({
    client_id: process.env.INSTAGRAM_APP_ID || '',
    client_secret: process.env.INSTAGRAM_APP_SECRET || '',
    grant_type: 'authorization_code',
    redirect_uri: adresaNavratu(),
    code: kod.replace(/#_$/, ''),
  });
  const r1 = await fetch('https://api.instagram.com/oauth/access_token', { method: 'POST', body: telo, cache: 'no-store' });
  const d1 = (await r1.json().catch(() => ({}))) as { access_token?: string; user_id?: string | number; error_message?: string };
  if (!r1.ok || !d1.access_token) return { ok: false, chyba: d1.error_message || `Instagram odmítl přihlášení (${r1.status}).` };

  const p2 = new URLSearchParams({
    grant_type: 'ig_exchange_token',
    client_secret: process.env.INSTAGRAM_APP_SECRET || '',
    access_token: d1.access_token,
  });
  const r2 = await fetch(`${API}/access_token?${p2.toString()}`, { cache: 'no-store' });
  const d2 = (await r2.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error?: { message?: string } };
  if (!r2.ok || !d2.access_token) return { ok: false, chyba: d2.error?.message || 'Dlouhodobý token se nepodařilo získat.' };

  const r3 = await fetch(`${API}/${VERZE}/me?fields=user_id,username&access_token=${encodeURIComponent(d2.access_token)}`, {
    cache: 'no-store',
  });
  const d3 = (await r3.json().catch(() => ({}))) as { user_id?: string; id?: string; username?: string };

  const data = {
    igUserId: String(d3.user_id ?? d3.id ?? d1.user_id ?? ''),
    username: d3.username ?? null,
    token: d2.access_token,
    tokenDo: new Date(Date.now() + (d2.expires_in ?? 60 * 24 * 3600) * 1000),
    cacheAt: null,
    chyba: null,
  };
  await prisma.instagramUcet.upsert({ where: { id: 'hlavni' }, create: { id: 'hlavni', ...data }, update: data });
  return { ok: true, username: data.username };
}

export async function odpojUcet(): Promise<void> {
  await prisma.instagramUcet.deleteMany({});
}

export async function stavInstagramu() {
  return prisma.instagramUcet
    .findUnique({ where: { id: 'hlavni' }, select: { username: true, tokenDo: true, chyba: true, cacheAt: true } })
    .catch(() => null);
}

type Surova = { id: string; media_type?: string; media_url?: string; thumbnail_url?: string; timestamp?: string };

function naPolozky(data: Surova[] | undefined): PolozkaInstagramu[] {
  return (data ?? [])
    .filter((m) => m.media_url && (m.media_type === 'IMAGE' || m.media_type === 'VIDEO' || m.media_type === 'CAROUSEL_ALBUM'))
    .map((m) => ({
      id: m.id,
      typ: m.media_type === 'VIDEO' ? ('VIDEO' as const) : ('IMAGE' as const),
      url: m.media_url!,
      nahled: m.thumbnail_url ?? null,
      kdy: m.timestamp ?? '',
    }));
}

/**
 * Příběhy pro tabuli. Nikdy nevyhazuje - když Instagram neodpoví, tabule
 * dostane poslední úspěšně stažené, nebo nic (okno se pak neukáže).
 */
export async function instagramProTabuli(): Promise<InstagramNaTabuli | null> {
  try {
    const ucet = await prisma.instagramUcet.findUnique({ where: { id: 'hlavni' } });
    if (!ucet) return null;
    const zCache = (ucet.cache ?? null) as InstagramNaTabuli | null;
    if (ucet.cacheAt && Date.now() - ucet.cacheAt.getTime() < CACHE_MS && zCache) return zCache;

    let token = ucet.token;
    // Prodloužení tokenu, když se blíží konec platnosti.
    if (ucet.tokenDo.getTime() - Date.now() < PRODLOUZIT_PRED_MS) {
      const r = await fetch(
        `${API}/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(token)}`,
        { cache: 'no-store' },
      );
      const d = (await r.json().catch(() => ({}))) as { access_token?: string; expires_in?: number };
      if (r.ok && d.access_token) {
        token = d.access_token;
        await prisma.instagramUcet.update({
          where: { id: 'hlavni' },
          data: { token, tokenDo: new Date(Date.now() + (d.expires_in ?? 60 * 24 * 3600) * 1000) },
        });
      }
    }

    const pole = 'id,media_type,media_url,thumbnail_url,timestamp';
    const rP = await fetch(`${API}/${VERZE}/me/stories?fields=${pole}&access_token=${encodeURIComponent(token)}`, {
      cache: 'no-store',
    });
    const dP = (await rP.json().catch(() => ({}))) as { data?: Surova[]; error?: { message?: string } };
    let vysledek: InstagramNaTabuli = { ucet: ucet.username, druh: 'pribehy', polozky: rP.ok ? naPolozky(dP.data) : [] };

    if (vysledek.polozky.length === 0) {
      const rM = await fetch(`${API}/${VERZE}/me/media?fields=${pole}&limit=8&access_token=${encodeURIComponent(token)}`, {
        cache: 'no-store',
      });
      const dM = (await rM.json().catch(() => ({}))) as { data?: Surova[]; error?: { message?: string } };
      if (!rM.ok && !rP.ok) {
        const chyba = dP.error?.message || dM.error?.message || `Instagram odpověděl ${rM.status}.`;
        await prisma.instagramUcet.update({ where: { id: 'hlavni' }, data: { chyba, cacheAt: new Date() } }).catch(() => undefined);
        return zCache;
      }
      vysledek = { ucet: ucet.username, druh: 'prispevky', polozky: naPolozky(dM.data) };
    }

    await prisma.instagramUcet
      .update({ where: { id: 'hlavni' }, data: { cache: JSON.parse(JSON.stringify(vysledek)) as Prisma.InputJsonValue, cacheAt: new Date(), chyba: null } })
      .catch(() => undefined);
    return vysledek;
  } catch (err) {
    console.error('Instagram pro tabuli selhal:', err);
    return null;
  }
}
