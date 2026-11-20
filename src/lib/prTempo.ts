import { prisma } from '@/lib/db';

/**
 * ABY SE Z EMY NESTAL SPAM (zadání 20. 11. 2026: „taky je třeba myslet na to,
 * aby se z Emy nestal spam. Když bude rozesílat hromadné maily v jeden den").
 *
 * Dvacet mailů z jedné adresy během deseti minut je pro poštovní servery
 * rozesílka, ne práce člověka - a jakmile si nás jednou zařadí, chodí do
 * spamu i poctivá odpověď redaktorovi. Proto maily neodcházejí naráz:
 *
 *  - V PRACOVNÍ DOBĚ. Po-Pá 8:00-17:30; co přijde jindy, počká na ráno.
 *    Nikdo z redakce nečte nabídku ve tři ráno a server to vidí taky.
 *  - S ROZESTUPY. Mezi dvěma maily 7 až 23 minut, pokaždé jinak - pravidelný
 *    takt je stejně poznat jako jedna dávka.
 *  - S DENNÍM STROPEM. Víc než PR_DENNI_STROP (výchozí 25) mailů za den
 *    z téhle adresy neodejde; zbytek se přesune na další dny.
 *
 * Člověk pořád mačká odeslání u každého média zvlášť - tohle jen rozhodne,
 * jestli mail odejde hned, nebo si počká ve frontě. Odesílá ho pak úloha
 * /api/cron/pr-fronta.
 */

const PASMO = 'Europe/Prague';

const OD_MINUTY = 8 * 60; // 8:00
const DO_MINUTY = 17 * 60 + 30; // 17:30
const ROZESTUP_MIN = 7;
const ROZESTUP_MAX = 23;

export function denniStrop(): number {
  const z = Number(process.env.PR_DENNI_STROP);
  return Number.isFinite(z) && z > 0 ? z : 25;
}

/** Kolik minut od půlnoci je na daném čase v Praze. */
function minutyDne(kdy: Date): number {
  const [h, m] = new Intl.DateTimeFormat('cs-CZ', {
    timeZone: PASMO,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
    .format(kdy)
    .split(':')
    .map((c) => Number(c));
  return h * 60 + m;
}

/** 1 = pondělí … 7 = neděle, počítáno v Praze. */
function denVTydnu(kdy: Date): number {
  const nazev = new Intl.DateTimeFormat('en-GB', { timeZone: PASMO, weekday: 'short' }).format(kdy);
  return { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }[nazev] ?? 1;
}

function jePracovniCas(kdy: Date): boolean {
  const den = denVTydnu(kdy);
  if (den > 5) return false;
  const min = minutyDne(kdy);
  return min >= OD_MINUTY && min <= DO_MINUTY;
}

/** Nejbližší okamžik v pracovní době - buď teď, nebo začátek dalšího dne. */
function nejblizsiPracovni(kdy: Date): Date {
  let cas = new Date(kdy);
  for (let i = 0; i < 14 * 24 * 60; i += 1) {
    if (jePracovniCas(cas)) return cas;
    // Posouvá se po pěti minutách - hrubě stačí, frontu pouští cron po pěti.
    cas = new Date(cas.getTime() + 5 * 60_000);
  }
  return cas;
}

function nahodnyRozestupMs(): number {
  const minuty = ROZESTUP_MIN + Math.random() * (ROZESTUP_MAX - ROZESTUP_MIN);
  // Nikdy ne kulatá minuta - ať to nevypadá jako stroj.
  return Math.round(minuty * 60_000 + Math.random() * 59_000);
}

function zacatekDne(kdy: Date): Date {
  const den = new Intl.DateTimeFormat('en-CA', {
    timeZone: PASMO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(kdy);
  // Praha je UTC+1/+2; pro počítání dnešních odeslání stačí půlnoc UTC daného dne.
  return new Date(`${den}T00:00:00.000Z`);
}

/** Kolik mailů z PR adresy dnes už odešlo. */
export async function odeslanoDnes(): Promise<number> {
  return prisma.prMedium
    .count({ where: { odeslanoAt: { gte: zacatekDne(new Date()) } } })
    .catch(() => 0);
}

/** Poslední odeslaný mail - od něj se počítá rozestup. */
async function poslednimOdeslano(): Promise<Date | null> {
  const m = (await prisma.prMedium
    .findFirst({
      where: { odeslanoAt: { not: null } },
      orderBy: { odeslanoAt: 'desc' },
      select: { odeslanoAt: true },
    })
    .catch(() => null)) as { odeslanoAt: Date | null } | null;
  return m?.odeslanoAt ?? null;
}

/** Nejpozdější už naplánovaný mail ve frontě. */
async function poslednimNaplanovano(): Promise<Date | null> {
  const m = (await prisma.prMedium
    .findFirst({
      where: { odeslatAt: { not: null }, odeslanoAt: null },
      orderBy: { odeslatAt: 'desc' },
      select: { odeslatAt: true },
    })
    .catch(() => null)) as { odeslatAt: Date | null } | null;
  return m?.odeslatAt ?? null;
}

export type Rozhodnuti =
  | { hned: true }
  | { hned: false; kdy: Date }
  /** Dnešní strop je vyčerpaný a fronta sahá dál, než má smysl plánovat. */
  | { hned: false; kdy: Date; strop: true };

/**
 * Rozhodne, kdy smí odejít další mail: hned, nebo za rozestup od posledního.
 * Počítá se jak z toho, co už odešlo, tak z toho, co čeká ve frontě - jinak
 * by deset kliknutí po sobě naplánovalo deset mailů na stejnou minutu.
 */
export async function kdyMuzeOdejit(): Promise<Rozhodnuti> {
  const ted = new Date();
  const dnes = await odeslanoDnes();
  const strop = denniStrop();

  const [odeslano, naplanovano] = await Promise.all([poslednimOdeslano(), poslednimNaplanovano()]);
  const posledni = [odeslano, naplanovano]
    .filter(Boolean)
    .map((d) => (d as Date).getTime())
    .sort((a, b) => b - a)[0];

  const nejdriv = posledni ? new Date(posledni + nahodnyRozestupMs()) : ted;
  const kdy = nejblizsiPracovni(new Date(Math.max(nejdriv.getTime(), ted.getTime())));

  if (dnes >= strop) {
    // Dnešek je plný - plánuje se na nejbližší pracovní ráno po dnešku.
    const zitra = nejblizsiPracovni(new Date(zacatekDne(ted).getTime() + 32 * 60 * 60_000));
    return { hned: false, kdy: kdy > zitra ? kdy : zitra, strop: true };
  }

  if (kdy.getTime() <= ted.getTime() + 30_000) return { hned: true };
  return { hned: false, kdy };
}

/** Smí cron zrovna teď odeslat? (Pracovní doba a denní strop.) */
export async function smiFrontaOdeslat(): Promise<boolean> {
  if (!jePracovniCas(new Date())) return false;
  return (await odeslanoDnes()) < denniStrop();
}
