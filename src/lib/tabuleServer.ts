import { randomBytes } from 'crypto';
import { prisma } from '@/lib/db';
import { loadOccupancy } from '@/lib/calendarServer';
import { BLOCK_KIND_LABELS } from '@/lib/calendar';
import { notify } from '@/lib/notifications';
import { brunoNapisSoukrome, vychoziPrijemceSmlouvy } from '@/lib/smlouvyKlientaServer';
import { nazevPolozky, type DataTabule } from '@/lib/tabule';

/**
 * Serverová strana tabule ve studiu (zadání 21. 9. 2026). Tabule se
 * nepřihlašuje - pozná se podle tajného klíče v adrese, který se nastavuje
 * v Administraci → Studia.
 */

export function novyKlicTabule(): string {
  return randomBytes(18).toString('base64url');
}

export async function studioPodleKlice(klic: string) {
  if (!klic || klic.length < 16) return null;
  return prisma.studio
    .findUnique({
      where: { tabuleKlic: klic },
      select: { id: true, name: true, shortName: true, color: true, timezone: true, rooms: { select: { id: true, shortName: true } } },
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

export async function nactiTabuli(studio: NonNullable<Awaited<ReturnType<typeof studioPodleKlice>>>): Promise<DataTabule> {
  const ted = new Date();
  const dnes = pulnoc(ted, studio.timezone);
  const zitra = pulnoc(ted, studio.timezone, 1);
  const pozitri = pulnoc(ted, studio.timezone, 2);
  const mistnosti = new Map<string, string>(studio.rooms.map((r: { id: string; shortName: string }) => [r.id, r.shortName]));
  const idcka = [studio.id, ...studio.rooms.map((r: { id: string }) => r.id)];

  const [obsazenost, poznamky, chybi] = await Promise.all([
    loadOccupancy(idcka, dnes, pozitri),
    prisma.studioPoznamka.findMany({
      where: { studioId: studio.id, hotovoAt: null },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    prisma.studioChybi.findMany({
      where: { studioId: studio.id, doplnenoAt: null },
      orderBy: { nahlasenoAt: 'asc' },
    }),
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
    poznamky: poznamky.map((p) => ({ id: p.id, text: p.text, autor: p.autor, kdy: p.createdAt.toISOString() })),
    chybi: chybi.map((c) => ({ polozka: c.polozka, kdy: c.nahlasenoAt.toISOString() })),
    ted: ted.toISOString(),
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
