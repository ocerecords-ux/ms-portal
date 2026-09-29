import { randomBytes } from 'crypto';
import { prisma } from '@/lib/db';
import { loadOccupancy } from '@/lib/calendarServer';
import { BLOCK_KIND_LABELS } from '@/lib/calendar';
import { notify } from '@/lib/notifications';
import { brunoNapisSoukrome, vychoziPrijemceSmlouvy } from '@/lib/smlouvyKlientaServer';
import { nazevPolozky, type DataTabule } from '@/lib/tabule';
import { instagramProTabuli } from '@/lib/instagramServer';

/**
 * Serverová strana tabule ve studiu (zadání 21. 9. 2026). Tabule se
 * nepřihlašuje - pozná se podle tajného klíče v adrese, který se nastavuje
 * v Administraci → Studia.
 *
 * POZNÁMKY Z TABULE ZMIZELY (29. 9. 2026: „dejme pryč z tabulí poznámky.
 * Dostaneme tak víc místa a můžeme zvětšit i Instagram"). Zabíraly celý pravý
 * sloupec a většinou na nich stálo „Žádné poznámky". Model StudioPoznamka
 * v databázi zůstává i s tím, co kdo napsal - smazat tabulku by ta data
 * zahodilo a získalo tím jen čistší schéma.
 */

export function novyKlicTabule(): string {
  return randomBytes(18).toString('base64url');
}

export async function studioPodleKlice(klic: string) {
  if (!klic || klic.length < 16) return null;
  return prisma.studio
    .findUnique({
      where: { tabuleKlic: klic },
      select: {
        id: true,
        name: true,
        shortName: true,
        color: true,
        timezone: true,
        tabuleInstagram: true,
        rooms: { select: { id: true, shortName: true } },
      },
    })
    .catch(() => null);
}

/** O kolik je čas v pásmu napřed před UTC (ms) v daném okamžiku. */
function posunPasma(okamzik: Date, pasmo: string): number {
  const casti = new Intl.DateTimeFormat('en-US', {
    timeZone: pasmo,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(okamzik);
  const v = (t: string) => Number(casti.find((c) => c.type === t)?.value);
  const jakoUtc = Date.UTC(v('year'), v('month') - 1, v('day'), v('hour'), v('minute'), v('second'));
  return jakoUtc - Math.floor(okamzik.getTime() / 1000) * 1000;
}

/** Půlnoc dne, ve kterém je `okamzik` v daném pásmu, posunutá o `dnu` dní. */
function pulnoc(okamzik: Date, pasmo: string, dnu = 0): Date {
  const posun = posunPasma(okamzik, pasmo);
  const mistni = new Date(okamzik.getTime() + posun);
  const zaklad = Date.UTC(mistni.getUTCFullYear(), mistni.getUTCMonth(), mistni.getUTCDate() + dnu);
  // Posun se v den změny času může lišit - dopočítá se k té půlnoci.
  return new Date(zaklad - posunPasma(new Date(zaklad), pasmo));
}

/**
 * CO SE DĚJE V OSTATNÍCH STUDIÍCH (zadání 29. 9. 2026).
 *
 * Bere se jen dnešek a jen to, co člověk u tabule potřebuje vědět: jestli tam
 * teď někdo točí a co je nejbližší další. Místnosti se počítají ke svému
 * studiu, ale v seznamu nestojí samostatně - jinak by se přehled rozsypal na
 * deset řádků.
 *
 * Vlastní studio se vynechává; to je na tabuli velké nahoře a tenhle pruh ho
 * má jen doplňovat.
 */
async function ostatniStudia(krometoho: string, ted: Date): Promise<DataTabule['ostatni']> {
  const studia = await prisma.studio.findMany({
    where: { active: true, parentStudioId: null, id: { not: krometoho } },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      name: true,
      shortName: true,
      color: true,
      timezone: true,
      rooms: { select: { id: true, shortName: true } },
    },
  });
  if (studia.length === 0) return [];

  /**
   * Okno se schválně bere podle pásma každého studia zvlášť - v Londýně je
   * jiný „dnešek" než v Brně a po půlnoci by se jinak ukazoval včerejšek.
   */
  const idcka = studia.flatMap((s) => [s.id, ...s.rooms.map((r) => r.id)]);
  const odKdy = new Date(Math.min(...studia.map((s) => pulnoc(ted, s.timezone).getTime())));
  const doKdy = new Date(Math.max(...studia.map((s) => pulnoc(ted, s.timezone, 1).getTime())));
  const obsazenost = await loadOccupancy(idcka, odKdy, doKdy);

  const vse = [
    ...obsazenost.slots.map((s) => ({
      start: s.start,
      end: s.end,
      nazev: s.projectName || 'Natáčení',
      herec: s.actorName || null,
      studioId: s.studioId,
    })),
    ...obsazenost.blocks.map((b) => ({
      start: b.start,
      end: b.end,
      nazev: b.projectName || b.title || BLOCK_KIND_LABELS[b.kind] || 'Blokace',
      herec: b.actorName,
      studioId: b.studioId,
    })),
  ].sort((a, b) => a.start.getTime() - b.start.getTime());

  return studia.map((s) => {
    const mistnosti = new Map<string, string>(
      s.rooms.map((r: { id: string; shortName: string }) => [r.id, r.shortName]),
    );
    const patriSem = new Set([s.id, ...s.rooms.map((r) => r.id)]);
    const zitra = pulnoc(ted, s.timezone, 1);
    const moje = vse.filter((u) => patriSem.has(u.studioId) && u.start < zitra);

    const bezi = moje.find((u) => u.start <= ted && u.end > ted) ?? null;
    const dalsi = moje.find((u) => u.start > ted) ?? null;

    return {
      id: s.id,
      nazev: s.name,
      kratce: s.shortName,
      barva: s.color,
      casovePasmo: s.timezone,
      probiha: bezi
        ? {
            nazev: bezi.nazev,
            do: bezi.end.toISOString(),
            mistnost: mistnosti.get(bezi.studioId) ?? null,
            herec: bezi.herec,
          }
        : null,
      dalsi: dalsi ? { od: dalsi.start.toISOString(), nazev: dalsi.nazev, herec: dalsi.herec } : null,
    };
  });
}

export async function nactiTabuli(studio: NonNullable<Awaited<ReturnType<typeof studioPodleKlice>>>): Promise<DataTabule> {
  const ted = new Date();
  const dnes = pulnoc(ted, studio.timezone);
  const zitra = pulnoc(ted, studio.timezone, 1);
  const pozitri = pulnoc(ted, studio.timezone, 2);
  const mistnosti = new Map<string, string>(studio.rooms.map((r: { id: string; shortName: string }) => [r.id, r.shortName]));
  const idcka = [studio.id, ...studio.rooms.map((r: { id: string }) => r.id)];

  const [obsazenost, chybi, instagram, ostatni] = await Promise.all([
    loadOccupancy(idcka, dnes, pozitri),
    prisma.studioChybi.findMany({
      where: { studioId: studio.id, doplnenoAt: null },
      orderBy: { nahlasenoAt: 'asc' },
    }),
    // Instagram (22. 9. 2026) - jen když ho studio nemá vypnutý.
    studio.tabuleInstagram ? instagramProTabuli() : Promise.resolve(null),
    ostatniStudia(studio.id, ted),
  ]);

  const vse = [
    ...obsazenost.slots.map((s) => ({
      id: `s-${s.id}`,
      start: s.start,
      end: s.end,
      nazev: s.projectName || 'Natáčení',
      druh: 'Natáčení',
      herec: s.actorName || null,
      zvukar: s.zvukarName,
      studioId: s.studioId,
    })),
    ...obsazenost.blocks.map((b) => ({
      id: `b-${b.id}`,
      start: b.start,
      end: b.end,
      nazev: b.projectName || b.title || BLOCK_KIND_LABELS[b.kind] || 'Blokace',
      druh: BLOCK_KIND_LABELS[b.kind] ?? 'Blokace',
      herec: b.actorName,
      zvukar: b.zvukarName,
      studioId: b.studioId,
    })),
  ].sort((a, b) => a.start.getTime() - b.start.getTime());

  const dnesni = vse.filter((u) => u.start < zitra && u.end > dnes);
  const prvniZitra = vse.find((u) => u.start >= zitra && u.start < pozitri) ?? null;

  return {
    studio: { nazev: studio.name, kratce: studio.shortName, barva: studio.color, casovePasmo: studio.timezone },
    udalosti: dnesni.map((u) => ({
      id: u.id,
      od: u.start.toISOString(),
      do: u.end.toISOString(),
      nazev: u.nazev,
      druh: u.druh,
      herec: u.herec,
      zvukar: u.zvukar,
      mistnost: u.studioId !== studio.id ? (mistnosti.get(u.studioId) ?? null) : null,
    })),
    zitra: prvniZitra ? { od: prvniZitra.start.toISOString(), nazev: prvniZitra.nazev, druh: prvniZitra.druh } : null,
    chybi: chybi.map((c) => ({ polozka: c.polozka, kdy: c.nahlasenoAt.toISOString() })),
    ted: ted.toISOString(),
    ostatni,
    instagram: instagram && instagram.polozky.length > 0 ? instagram : null,
  };
}

/**
 * Někdo na tabuli ťukl, že něco chybí - Bruno napíše Báře Šiblové
 * (zadání 21. 9. 2026: komu má chodit upozornění → „Barboře Šiblové").
 */
export async function oznamChybi(studioNazev: string, polozka: string): Promise<void> {
  try {
    const bara = await vychoziPrijemceSmlouvy();
    if (!bara) {
      console.warn('Tabule: Bára Šiblová nemá účet, upozornění na chybějící věc neodešlo.');
      return;
    }
    const nazev = nazevPolozky(polozka);
    await brunoNapisSoukrome(
      bara.id,
      `Ve studiu ${studioNazev} došlo: ${nazev.toLowerCase()}. Nahlásili to na tabuli. Až to doplníš, ťukni na tabuli na „${nazev}", ať to zhasne (nebo v Administraci → Studia).`,
    );
    await notify({
      userId: bara.id,
      kind: 'STUDIO_CHYBI',
      title: `${studioNazev}: chybí ${nazev.toLowerCase()}`,
      body: 'Nahlášeno na tabuli ve studiu.',
      url: '/admin/studia',
    });
  } catch (err) {
    console.error('Upozornění na chybějící věc ve studiu selhalo:', err);
  }
}
