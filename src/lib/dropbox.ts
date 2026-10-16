/**
 * NAPOJENÍ NA DROPBOX (zadání 16. 10. 2026: „potřebuju u projektů mít kartu,
 * kde budu vkládat hudbu… budu vkládat wav, který má jeden v průměru kolem
 * 50 MB. Používáme dropbox").
 *
 * PROČ SOUBOR NEJDE PŘES PORTÁL. Funkce na Vercelu mají strop na velikost
 * požadavku kolem 4,5 MB - padesátimegový WAV se přes ně neprotlačí a není to
 * věc nastavení. Portál proto jen VYRÁBÍ ADRESY: `odkazNaNahrani` řekne
 * Dropboxu „tenhle soubor půjde na tuhle cestu" a dostane jednorázovou adresu,
 * na kterou prohlížeč soubor pošle sám. Token se do prohlížeče nikdy
 * nedostane a cestu určuje výhradně server - kdyby ji posílal prohlížeč, dala
 * by se jí přepsat cizí nahrávka. Je to tentýž postup jako u příloh v chatu
 * (viz /api/chat/prilohy/podpis).
 *
 * REFRESH TOKEN, NE ACCESS TOKEN. Access token z App console platí čtyři
 * hodiny; portál by za půl dne přestal fungovat. V nastavení je proto
 * dlouhodobý refresh token a krátkodobý se z něj vyrábí tady, s malou rezervou
 * před vypršením.
 *
 * TÝMOVÝ PROSTOR. U Dropboxu Business píše aplikace autorizovaná členem týmu
 * do JEHO OSOBNÍHO prostoru, dokud nedostane hlavičku `Dropbox-API-Path-Root`
 * s kořenem týmu. Bez ní by soubory tiše mizely někam, kde je nikdo nehledá.
 * Kořen se jednou přečte z účtu a drží se v paměti.
 */

const API = 'https://api.dropboxapi.com/2';
const CONTENT = 'https://content.dropboxapi.com/2';

export function dropboxNastaven(): boolean {
  return Boolean(
    process.env.DROPBOX_APP_KEY?.trim() &&
      process.env.DROPBOX_APP_SECRET?.trim() &&
      process.env.DROPBOX_REFRESH_TOKEN?.trim(),
  );
}

/** Kořenová složka, pod kterou se zakládají složky projektů. */
export function korenHudby(): string {
  const cesta = process.env.DROPBOX_HUDBA_CESTA?.trim() || '/Hudba k projektům';
  return cesta.replace(/\/+$/, '');
}

type Token = { token: string; plati: number };
let tokenCache: Token | null = null;
let korenTymu: string | null | undefined;

/** Krátkodobý token z refresh tokenu. Drží se, dokud má aspoň minutu života. */
async function accessToken(): Promise<string | null> {
  if (!dropboxNastaven()) return null;
  if (tokenCache && tokenCache.plati > Date.now() + 60_000) return tokenCache.token;

  const klic = process.env.DROPBOX_APP_KEY!.trim();
  const tajne = process.env.DROPBOX_APP_SECRET!.trim();
  const refresh = process.env.DROPBOX_REFRESH_TOKEN!.trim();

  try {
    const res = await fetch('https://api.dropboxapi.com/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${klic}:${tajne}`).toString('base64')}`,
      },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refresh }),
    });
    if (!res.ok) {
      console.error('Dropbox: token se nepodařilo obnovit:', res.status, await res.text());
      return null;
    }
    const data = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!data.access_token) return null;
    tokenCache = {
      token: data.access_token,
      plati: Date.now() + (data.expires_in ?? 14_400) * 1000,
    };
    return tokenCache.token;
  } catch (err) {
    console.error('Dropbox: token se nepodařilo obnovit:', err);
    return null;
  }
}

/**
 * Kořen týmového prostoru. `null` znamená „účet žádný tým nemá" - pak se
 * hlavička neposílá a píše se do osobního Dropboxu, což je u osobního účtu
 * správně.
 */
async function rootNamespace(token: string): Promise<string | null> {
  if (korenTymu !== undefined) return korenTymu;
  try {
    const res = await fetch(`${API}/users/get_current_account`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      console.error('Dropbox: účet se nepodařilo načíst:', res.status, await res.text());
      korenTymu = null;
      return null;
    }
    const data = (await res.json()) as {
      root_info?: { root_namespace_id?: string; home_namespace_id?: string };
    };
    const koren = data.root_info?.root_namespace_id ?? null;
    // Když se kořen rovná domovskému, žádný tým nad ním není.
    korenTymu = koren && koren !== data.root_info?.home_namespace_id ? koren : null;
    return korenTymu;
  } catch (err) {
    console.error('Dropbox: účet se nepodařilo načíst:', err);
    korenTymu = null;
    return null;
  }
}

async function hlavicky(token: string): Promise<Record<string, string>> {
  const koren = await rootNamespace(token);
  const zaklad: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (koren) {
    zaklad['Dropbox-API-Path-Root'] = JSON.stringify({ '.tag': 'root', root: koren });
  }
  return zaklad;
}

/** Jedno volání do Dropbox API s JSON tělem. */
async function volej<T>(cesta: string, telo: unknown): Promise<T | null> {
  const token = await accessToken();
  if (!token) return null;
  try {
    const res = await fetch(`${API}${cesta}`, {
      method: 'POST',
      headers: { ...(await hlavicky(token)), 'Content-Type': 'application/json' },
      body: JSON.stringify(telo),
    });
    if (!res.ok) {
      console.error(`Dropbox ${cesta}:`, res.status, await res.text());
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    console.error(`Dropbox ${cesta}:`, err);
    return null;
  }
}

/**
 * Jednorázová adresa, na kterou prohlížeč nahraje soubor. Platí čtyři hodiny
 * a přijme JEDEN soubor na předem danou cestu.
 *
 * `autorename` schválně: když se dva lidé trefí do stejného názvu, Dropbox
 * přidá číslo místo aby jeden druhému přepsal nahrávku.
 */
export async function odkazNaNahrani(cesta: string): Promise<string | null> {
  const data = await volej<{ link?: string }>('/files/get_temporary_upload_link', {
    commit_info: { path: cesta, mode: 'add', autorename: true, mute: true },
    duration: 4 * 60 * 60,
  });
  return data?.link ?? null;
}

/** Přímá adresa na přehrání nebo stažení. Platí čtyři hodiny. */
export async function odkazNaPrehrani(cesta: string): Promise<string | null> {
  const data = await volej<{ link?: string }>('/files/get_temporary_link', { path: cesta });
  return data?.link ?? null;
}

export type SouborVDropboxu = { id: string; cesta: string; nazev: string; velikost: number };

/** Co o souboru Dropbox ví - podle toho se po nahrání ověří, že tam opravdu je. */
export async function metadataSouboru(cesta: string): Promise<SouborVDropboxu | null> {
  const data = await volej<{
    id?: string;
    name?: string;
    path_display?: string;
    size?: number;
  }>('/files/get_metadata', { path: cesta });
  if (!data?.id || !data.name) return null;
  return {
    id: data.id,
    cesta: data.path_display ?? cesta,
    nazev: data.name,
    velikost: data.size ?? 0,
  };
}

/**
 * Založí složku, když ještě není. Existující složka vrací chybu `conflict`,
 * což tady není chyba - proto se výsledek nezkoumá.
 */
export async function zalozSlozku(cesta: string): Promise<void> {
  await volej('/files/create_folder_v2', { path: cesta, autorename: false });
}

/** Spojení stojí? Na diagnostiku v /api/health - nic nemění. */
export async function overSpojeni(): Promise<{ ok: boolean; tym: boolean; duvod?: string }> {
  if (!dropboxNastaven()) return { ok: false, tym: false, duvod: 'Chybí klíče v nastavení.' };
  const token = await accessToken();
  if (!token) return { ok: false, tym: false, duvod: 'Token se nepodařilo obnovit.' };
  const koren = await rootNamespace(token);
  const koš = await volej<{ entries?: unknown[] }>('/files/list_folder', {
    path: korenHudby(),
    limit: 1,
  });
  if (!koš) {
    return { ok: false, tym: Boolean(koren), duvod: `Složka ${korenHudby()} není dostupná.` };
  }
  return { ok: true, tym: Boolean(koren) };
}

/**
 * Bezpečný název souboru i složky: bez diakritiky, bez mezer, bez znaků, na
 * kterých cesty padají. Stejné pravidlo jako u názvů tracků.
 */
export function bezpecnyNazev(text: string): string {
  return (
    text
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[\\/:*?"<>|]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 150) || 'soubor'
  );
}
