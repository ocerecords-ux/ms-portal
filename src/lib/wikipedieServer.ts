import { prisma } from '@/lib/db';
import { notify } from '@/lib/notifications';
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
  if (!res.ok) throw new Error(`Wikipedie náhled nevykreslila (${res.status}).`);
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
  if (!res.ok) throw new Error(`Wikipedie neodpověděla (${res.status}).`);
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
