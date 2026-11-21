import { prisma } from '@/lib/db';
import { notify } from '@/lib/notifications';
import { prelozit, prelozitS } from '@/lib/jazyk';
import { adresaWiki } from '@/lib/wikipedie';

/**
 * WIKIPEDIE (zadání 22. 9. 2026: „chtěl bych u sebe udělat nějaký modul na
 * wikipedii a editaci mé osoby. Účet na wiki nemám" → „Koncept + hlídání").
 *
 * Portál na Wikipedii nic neukládá ani za nikoho neupravuje:
 *  - náhled konceptu nechá vykreslit veřejnou službou Wikipedie (bez účtu),
 *  - hlídání čte veřejné API (historie revizí) a cizí úpravu ohlásí zvonkem.
 * Wikimedia chce u každého dotazu User-Agent s kontaktem.
 */

const UA = 'MSPortal-Wikipedie/1.0 (https://www.msportal.cz)';

/**
 * CHYBA, KTERÁ NESE KLÍČ (dávka 7aa, vzor z dávky 7w).
 *
 * `vykresliNahled` a `stavClanku` chybu vyhazují - čte ji routa (ta má klíč
 * poslat obrazovce) i hodinová kontrola (ta si větu ukládá do databáze ke
 * článku). Výjimka proto nese obojí: `klic` pro routu a českou větu
 * v `message` pro databázi. Čeština zůstává zdrojem pravdy (pravidlo 1).
 */
export class ChybaWiki extends Error {
  readonly klic: string;
  readonly hodnoty?: Record<string, string | number>;
  constructor(klic: string, hodnoty?: Record<string, string | number>) {
    super(hodnoty ? prelozitS('cs', klic, hodnoty) : prelozit('cs', klic));
    this.klic = klic;
    this.hodnoty = hodnoty;
  }
}

function api(jazyk: string): string {
  return `https://${jazyk}.wikipedia.org/w/api.php`;
}

/** Vykreslí wikitext tak, jak by vypadal na Wikipedii (jen tělo stránky). */
export async function vykresliNahled(jazyk: string, nazev: string, wikitext: string): Promise<string> {
  const titul = encodeURIComponent((nazev.trim() || 'Koncept').replace(/ /g, '_'));
  const res = await fetch(`https://${jazyk}.wikipedia.org/api/rest_v1/transform/wikitext/to/html/${titul}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': UA, 'Api-User-Agent': UA },
    body: JSON.stringify({ wikitext, body_only: true }),
    cache: 'no-store',
  });
  if (!res.ok) throw new ChybaWiki('chybaApi.wikiNahledNevykreslenS', { stav: res.status });
  return res.text();
}

export type RevizeWiki = {
  revid: number;
  kdy: string;
  kdo: string;
  shrnuti: string;
  velikost: number;
  diff: string;
};

export type StavWiki = { existuje: boolean; url: string; revize: RevizeWiki[] };

/** Posledních pár úprav živého článku. */
export async function stavClanku(jazyk: string, nazev: string, kolik = 10): Promise<StavWiki> {
  const p = new URLSearchParams({
    action: 'query',
    prop: 'revisions',
    titles: nazev.trim(),
    rvprop: 'ids|timestamp|user|comment|size',
    rvlimit: String(kolik),
    redirects: '1',
    format: 'json',
    formatversion: '2',
  });
  const res = await fetch(`${api(jazyk)}?${p.toString()}`, { headers: { 'User-Agent': UA, 'Api-User-Agent': UA }, cache: 'no-store' });
  if (!res.ok) throw new ChybaWiki('chybaApi.wikiNeodpovedelaS', { stav: res.status });
  const data = (await res.json()) as {
    query?: { pages?: { title: string; missing?: boolean; revisions?: { revid: number; timestamp: string; user?: string; comment?: string; size?: number }[] }[] };
  };
  const stranka = data.query?.pages?.[0];
  const titul = stranka?.title ?? nazev;
  if (!stranka || stranka.missing) return { existuje: false, url: adresaWiki(jazyk, titul), revize: [] };
  return {
    existuje: true,
    url: adresaWiki(jazyk, titul),
    revize: (stranka.revisions ?? []).map((r) => ({
      revid: r.revid,
      kdy: r.timestamp,
      kdo: r.user ?? '(skrytý)',
      shrnuti: r.comment ?? '',
      velikost: r.size ?? 0,
      diff: `https://${jazyk}.wikipedia.org/w/index.php?diff=${r.revid}&oldid=prev`,
    })),
  };
}

/**
 * Hodinová kontrola (cron /api/cron/wikipedie). U každého hlídaného článku
 * porovná poslední revizi s uloženou; při první kontrole jen zapamatuje.
 */
export async function zkontrolujClanky(): Promise<{ zkontrolovano: number; zmeny: number }> {
  const clanky = await prisma.wikiClanek.findMany({ where: { sledovanyNazev: { not: null } } });
  let zmeny = 0;
  for (const c of clanky) {
    try {
      const stav = await stavClanku(c.jazyk, c.sledovanyNazev!, 5);
      const posledni = stav.revize[0];
      if (posledni && c.posledniRevize && posledni.revid > c.posledniRevize) {
        const nove = stav.revize.filter((r) => r.revid > c.posledniRevize!);
        zmeny += 1;
        await notify({
          userId: c.userId,
          kind: 'wikipedie',
          title: `Článek „${c.sledovanyNazev}" na Wikipedii někdo upravil`,
          body: nove.map((r) => `${r.kdo}${r.shrnuti ? `: ${r.shrnuti}` : ''}`).join(' · ').slice(0, 400),
          url: nove.length === 1 ? posledni.diff : `https://${c.jazyk}.wikipedia.org/w/index.php?title=${encodeURIComponent(c.sledovanyNazev!)}&action=history`,
        });
      }
      await prisma.wikiClanek.update({
        where: { id: c.id },
        data: {
          posledniRevize: posledni?.revid ?? c.posledniRevize,
          posledniKontrola: new Date(),
          chybaKontroly: stav.existuje ? null : 'Stránka na Wikipedii zatím neexistuje.',
        },
      });
    } catch (err) {
      await prisma.wikiClanek
        .update({ where: { id: c.id }, data: { posledniKontrola: new Date(), chybaKontroly: String((err as Error).message ?? err) } })
        .catch(() => undefined);
    }
  }
  return { zkontrolovano: clanky.length, zmeny };
}

/**
 * ODESLÁNÍ ÚPRAVY NA WIKIPEDII (zadání 22. 9. 2026: „chci to rovnou odesílat
 * z portálu").
 *
 * Portál píše POD ÚČTEM UŽIVATELE - přes osobní přístupový token z OAuth
 * (na meta.wikimedia.org, druh „owner-only", takže ho schvalovat nikdo
 * nemusí). Token si každý uloží sám v modulu a portál ho nikdy nevrací zpátky
 * do prohlížeče; slouží jen k tomuhle volání.
 *
 * Nejdřív se vyzvedne editační token (csrf) a s ním se teprve ukládá - tak to
 * MediaWiki vyžaduje.
 */
export async function odesliNaWiki(vstup: {
  jazyk: string;
  titul: string;
  wikitext: string;
  shrnuti: string;
  token: string;
}): Promise<
  | { ok: true; url: string; revid: number | null }
  | { ok: false; klic: string; hodnoty?: Record<string, string | number> }
> {
  const { jazyk, titul, wikitext, shrnuti, token } = vstup;
  const hlavicky = { 'User-Agent': UA, 'Api-User-Agent': UA, Authorization: `Bearer ${token}` };
  try {
    const rt = await fetch(`${api(jazyk)}?action=query&meta=tokens&type=csrf&format=json&formatversion=2`, {
      headers: hlavicky,
      cache: 'no-store',
    });
    const dt = (await rt.json().catch(() => ({}))) as {
      query?: { tokens?: { csrftoken?: string } };
      error?: { info?: string };
    };
    const csrf = dt.query?.tokens?.csrftoken;
    if (!csrf || csrf === '+\\') {
      // Vysvětlení od Wikipedie chodí jejím jazykem - jde proto do značky, ne
      // do věty (pravidlo 7). Když žádné není, jde prostý klíč.
      return dt.error?.info
        ? { ok: false, klic: 'chybaApi.wikiTokenNeprijataS', hodnoty: { zprava: dt.error.info } }
        : { ok: false, klic: 'chybaApi.wikiTokenNeprijata' };
    }

    const telo = new URLSearchParams({
      action: 'edit',
      title: titul,
      text: wikitext,
      summary: shrnuti || 'Úprava z MS Portalu',
      token: csrf,
      format: 'json',
      formatversion: '2',
    });
    const re = await fetch(api(jazyk), {
      method: 'POST',
      headers: { ...hlavicky, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: telo,
      cache: 'no-store',
    });
    const de = (await re.json().catch(() => ({}))) as {
      edit?: { result?: string; newrevid?: number; title?: string };
      error?: { code?: string; info?: string };
    };
    if (de.error || de.edit?.result !== 'Success') {
      return de.error?.info
        ? { ok: false, klic: 'chybaApi.wikiUpravuOdmitlaS', hodnoty: { zprava: de.error.info } }
        : {
            ok: false,
            klic: 'chybaApi.wikiUpravaNeulozenaS',
            hodnoty: { zprava: de.edit?.result ?? re.status },
          };
    }
    return { ok: true, url: adresaWiki(jazyk, de.edit.title ?? titul), revid: de.edit.newrevid ?? null };
  } catch (err) {
    // Věta se značkou jen tehdy, když zpráva z výjimky je - jinak by
    // v anglické větě svítila česká závorka (vzor z dávky 7y).
    const zprava = err instanceof Error ? err.message : '';
    return zprava
      ? { ok: false, klic: 'chybaApi.wikiNeodpovedelaZpravaS', hodnoty: { zprava } }
      : { ok: false, klic: 'chybaApi.wikiNeodpovedela' };
  }
}
