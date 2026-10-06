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

/** Hodnoty z Vercelu bez mezer a zalomení (vložený klíč s koncovým Enterem Instagram odmítne). */
function appId(): string {
  return (process.env.INSTAGRAM_APP_ID || '').trim();
}
function appSecret(): string {
  return (process.env.INSTAGRAM_APP_SECRET || '').trim();
}

export function instagramNastaven(): boolean {
  return Boolean(appId() && appSecret());
}

export function adresaNavratu(): string {
  return `${zakladPortalu()}/api/admin/instagram/navrat`;
}

export function odkazPrihlaseni(state: string): string {
  const p = new URLSearchParams({
    enable_fb_login: '0',
    force_authentication: '1',
    client_id: appId(),
    redirect_uri: adresaNavratu(),
    response_type: 'code',
    scope: 'instagram_business_basic,instagram_business_content_publish',
    state,
  });
  return `https://www.instagram.com/oauth/authorize?${p.toString()}`;
}

/** Kód z přihlášení → dlouhodobý token, uloží se. */
export async function pripojUcet(kod: string): Promise<{ ok: true; username: string | null } | { ok: false; chyba: string }> {
  const telo = new URLSearchParams({
    client_id: appId(),
    client_secret: appSecret(),
    grant_type: 'authorization_code',
    redirect_uri: adresaNavratu(),
    code: kod.replace(/#_$/, ''),
  });
  const r1 = await fetch('https://api.instagram.com/oauth/access_token', { method: 'POST', body: telo, cache: 'no-store' });
  const d1 = (await r1.json().catch(() => ({}))) as { access_token?: string; user_id?: string | number; error_message?: string };
  if (!r1.ok || !d1.access_token) {
    console.error('[instagram] výměna kódu selhala', r1.status, JSON.stringify(d1), {
      redirect_uri: adresaNavratu(),
      client_id: appId(),
      delkaTajemstvi: appSecret().length,
      delkaKodu: kod.length,
    });
    return { ok: false, chyba: d1.error_message || `Instagram odmítl přihlášení (${r1.status}).` };
  }

  const p2 = new URLSearchParams({
    grant_type: 'ig_exchange_token',
    client_secret: appSecret(),
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

/**
 * VYVĚŠENÍ PŘÍBĚHU PŘES API (zadání 6. 10. 2026: „můžeme dát zvukařům
 * přístup, aby mohli posílat na instagram příběhy, aniž by měli přístup na
 * instagram?").
 *
 * DVA KROKY, JAK TO CHCE META: nejdřív se založí kontejner
 * (`media_type=STORIES` a ADRESA souboru), pak se potvrdí. Soubor si Instagram
 * stáhne SÁM ze svých serverů - proto se mu posílá podepsaná adresa úložiště
 * s delší platností, ne odkaz do portálu, který chce přihlášení.
 *
 * U VIDEA SE MUSÍ POČKAT. Kontejner se založí hned, ale video se na straně
 * Mety ještě zpracovává a potvrzení dřív než dojede skončí chybou - proto se
 * stav kontejneru obvolává, dokud není FINISHED.
 *
 * TEXT SE NEPŘIPOJUJE. Instagram u příběhů popisek přes API nebere; co má být
 * v obrázku, musí být v obrázku. Text z portálu proto zůstává jen poznámkou
 * pro toho, kdo příběh vyvěšuje.
 *
 * NIKDY NEVYHAZUJE - vrací důvod, který se dá ukázat ve frontě.
 */
export type VysledekVyveseni = { ok: true; id: string } | { ok: false; chyba: string };

const CEKANI_NA_VIDEO_MS = 3_000;
/** 15 x 3 s = 45 s; funkce na Vercelu ma strop 60 s, at zbyde na odpoved. */
const POKUSU_NA_VIDEO = 15;
/**
 * I FOTKA SE MUSÍ POČKAT (oprava 6. 10. 2026: první vyvěšení spadlo na
 * „Media ID is not available"). Meta kontejner založí a hned vrátí jeho id,
 * ale ještě chvíli ho zpracovává - potvrzení poslané o vteřinu dřív skončí
 * právě touhle hláškou, jako by id neexistovalo. U fotky je to otázka
 * vteřin, proto stačí pár pokusů.
 */
const CEKANI_NA_FOTKU_MS = 1_200;
const POKUSU_NA_FOTKU = 8;

export async function vyvesPribeh(adresaSouboru: string, jeVideo: boolean): Promise<VysledekVyveseni> {
  try {
    const ucet = await prisma.instagramUcet.findUnique({ where: { id: 'hlavni' } });
    if (!ucet) return { ok: false, chyba: 'Instagram není připojený.' };
    const token = await platnyToken(ucet);

    const zalozeni = new URLSearchParams({
      media_type: 'STORIES',
      [jeVideo ? 'video_url' : 'image_url']: adresaSouboru,
      access_token: token,
    });
    const r1 = await fetch(`${API}/${VERZE}/me/media`, { method: 'POST', body: zalozeni, cache: 'no-store' });
    const d1 = (await r1.json().catch(() => ({}))) as { id?: string; error?: { message?: string } };
    if (!r1.ok || !d1.id) {
      return { ok: false, chyba: d1.error?.message || `Instagram odmítl příběh (${r1.status}).` };
    }

    const hotovo = await pockejNaZpracovani(d1.id, token, jeVideo);
    // U videa je nedočkané potvrzení jistý neúspěch, u fotky to zkusíme i tak.
    if (!hotovo.ok && jeVideo) return hotovo;

    const d2 = await potvrd(d1.id, token);
    if (!d2.ok) return d2;
    // Novy pribeh znamena, ze cache pro tabule uz neplati.
    await prisma.instagramUcet.update({ where: { id: 'hlavni' }, data: { cacheAt: null } }).catch(() => undefined);
    return d2;
  } catch (err) {
    console.error('Vyvěšení příběhu selhalo:', err);
    return { ok: false, chyba: 'Instagram se nepodařilo oslovit.' };
  }
}

/**
 * POTVRZENÍ KONTEJNERU, s jedním opakováním.
 *
 * „Media ID is not available" znamená „kontejner ještě není hotový", ne
 * „neexistuje" - stačí počkat a zkusit to znovu. Opakuje se jen na tuhle
 * jednu hlášku; cokoli jiného je skutečná chyba a opakováním se nespraví.
 */
async function potvrd(kontejner: string, token: string): Promise<VysledekVyveseni> {
  let posledni = '';
  for (let pokus = 0; pokus < 2; pokus += 1) {
    const telo = new URLSearchParams({ creation_id: kontejner, access_token: token });
    const r = await fetch(`${API}/${VERZE}/me/media_publish`, { method: 'POST', body: telo, cache: 'no-store' });
    const d = (await r.json().catch(() => ({}))) as { id?: string; error?: { message?: string } };
    if (r.ok && d.id) return { ok: true, id: d.id };
    posledni = d.error?.message || `Instagram příběh nevyvěsil (${r.status}).`;
    if (!/media id is not available/i.test(posledni)) break;
    await new Promise((h) => setTimeout(h, 4_000));
  }
  return { ok: false, chyba: posledni };
}

/** Token, který ještě chvíli platí - prodlouží se, když se blíží konec. */
async function platnyToken(ucet: { token: string; tokenDo: Date }): Promise<string> {
  if (ucet.tokenDo.getTime() - Date.now() >= PRODLOUZIT_PRED_MS) return ucet.token;
  const r = await fetch(
    `${API}/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(ucet.token)}`,
    { cache: 'no-store' },
  );
  const d = (await r.json().catch(() => ({}))) as { access_token?: string; expires_in?: number };
  if (!r.ok || !d.access_token) return ucet.token;
  await prisma.instagramUcet
    .update({
      where: { id: 'hlavni' },
      data: { token: d.access_token, tokenDo: new Date(Date.now() + (d.expires_in ?? 60 * 24 * 3600) * 1000) },
    })
    .catch(() => undefined);
  return d.access_token;
}

/** Obvolává stav kontejneru, dokud ho Meta nezpracuje. */
async function pockejNaZpracovani(
  kontejner: string,
  token: string,
  jeVideo: boolean,
): Promise<VysledekVyveseni> {
  const pokusu = jeVideo ? POKUSU_NA_VIDEO : POKUSU_NA_FOTKU;
  const cekani = jeVideo ? CEKANI_NA_VIDEO_MS : CEKANI_NA_FOTKU_MS;
  for (let pokus = 0; pokus < pokusu; pokus += 1) {
    await new Promise((hotovo) => setTimeout(hotovo, cekani));
    const r = await fetch(
      `${API}/${VERZE}/${kontejner}?fields=status_code,status&access_token=${encodeURIComponent(token)}`,
      { cache: 'no-store' },
    );
    const d = (await r.json().catch(() => ({}))) as { status_code?: string; status?: string };
    if (d.status_code === 'FINISHED') return { ok: true, id: kontejner };
    if (d.status_code === 'ERROR' || d.status_code === 'EXPIRED') {
      return { ok: false, chyba: d.status || 'Instagram video nepřijal.' };
    }
  }
  return { ok: false, chyba: 'Instagram soubor zpracovává moc dlouho. Zkuste to za chvíli znovu.' };
}

/** Umí portál vyvěšovat sám? Jen když je účet připojený. */
export async function lzeVyvesitPresApi(): Promise<boolean> {
  try {
    return (await prisma.instagramUcet.count({ where: { id: 'hlavni' } })) > 0;
  } catch {
    return false;
  }
}
