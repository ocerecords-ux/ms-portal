import { prisma } from '@/lib/db';

/**
 * KAPACITA STUDIÍ (zadání 20. 9. 2026: „potřebuju udělat přehled všech studií
 * v rámci obsazení termínů natáčením… jednoduchý grafický přehled, taková
 * mapa obsazenosti, abych viděl všechna studia po měsících a jen natáčení.
 * Jde mi o to analyzovat, jakou máme aktuálně kapacitu").
 *
 * Počítá se JEN NATÁČENÍ - potvrzené frekvence z nabídky a ručně zapsané
 * natáčení. Střih, casting, údržba, svátky ani dovolené se do obsazenosti
 * nepočítají: kapacita studia je o tom, kolik hodin se v kabině dá točit.
 *
 * Kapacita měsíce = otevírací doba studia (Studia → hodiny) den po dni.
 * Dny „jen po domluvě" (víkendy) se do kapacity NEPOČÍTAJÍ, ale natáčení,
 * které v nich je, ano - proto může u některého měsíce vyjít přes 100 %.
 * Je to tak čitelnější než počítat víkendy, které se běžně netočí.
 */

export type MesicKapacity = {
  /** 1-12 */
  mesic: number;
  /** Minuty otevírací doby (bez dnů jen po domluvě). */
  kapacitaMinut: number;
  /** Minuty natáčení. */
  natoceno: number;
  /** Kolik frekvencí/událostí natáčení do měsíce spadlo. */
  pocet: number;
};

export type StudioKapacita = {
  id: string;
  nazev: string;
  barva: string;
  mesice: MesicKapacity[];
  kapacitaMinut: number;
  natoceno: number;
  pocet: number;
};

export type PrehledKapacity = {
  rok: number;
  studia: StudioKapacita[];
  /** Součet přes všechna studia, po měsících. */
  celkem: MesicKapacity[];
};

/** Průnik dvou úseků v minutách. */
function prekryvMinut(aOd: Date, aDo: Date, bOd: Date, bDo: Date): number {
  const od = Math.max(aOd.getTime(), bOd.getTime());
  const doo = Math.min(aDo.getTime(), bDo.getTime());
  return doo > od ? Math.round((doo - od) / 60000) : 0;
}

/** Posun pásma studia v daném okamžiku, v minutách. */
function posunPasma(kdy: Date, pasmo: string): number {
  const casti = new Intl.DateTimeFormat('en-GB', {
    timeZone: pasmo,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(kdy);
  const v = (t: string) => Number(casti.find((c) => c.type === t)?.value);
  const mistni = Date.UTC(v('year'), v('month') - 1, v('day'), v('hour'), v('minute'));
  return Math.round((mistni - kdy.getTime()) / 60000);
}

/** Půlnoc daného dne v pásmu studia, jako skutečný okamžik (UTC). */
function pulnoc(rok: number, mesic: number, den: number, pasmo: string): Date {
  const odhad = Date.UTC(rok, mesic - 1, den, 0, 0);
  const posun = posunPasma(new Date(odhad), pasmo);
  return new Date(odhad - posun * 60000);
}

function prazdneMesice(): MesicKapacity[] {
  return Array.from({ length: 12 }, (_, i) => ({
    mesic: i + 1,
    kapacitaMinut: 0,
    natoceno: 0,
    pocet: 0,
  }));
}

export async function nactiKapacitu(rok: number): Promise<PrehledKapacity> {
  const studia = await prisma.studio.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    include: { hours: true },
  });

  const zacatek = new Date(Date.UTC(rok - 1, 11, 25));
  const konec = new Date(Date.UTC(rok + 1, 0, 7));

  const [sloty, bloky] = await Promise.all([
    prisma.recordingSlot.findMany({
      where: { state: 'CONFIRMED', start: { lt: konec }, end: { gt: zacatek } },
      select: { studioId: true, start: true, end: true },
    }),
    prisma.studioBlock.findMany({
      where: { kind: 'NATACENI', start: { lt: konec }, end: { gt: zacatek } },
      select: { studioId: true, start: true, end: true },
    }),
  ]);
  const nataceni = [...sloty, ...bloky];

  const vysledek: StudioKapacita[] = studia.map((s) => {
    type Hodiny = { weekday: number; startMinutes: number; endMinutes: number; byArrangement: boolean };
    const podleDne = new Map<number, Hodiny>(
      (s.hours as Hodiny[]).map((h) => [h.weekday, h]),
    );
    const mesice = prazdneMesice();

    for (let m = 1; m <= 12; m += 1) {
      const zacatekMesice = pulnoc(rok, m, 1, s.timezone);
      const konecMesice = m === 12 ? pulnoc(rok + 1, 1, 1, s.timezone) : pulnoc(rok, m + 1, 1, s.timezone);

      // Kapacita: den po dni podle otevírací doby studia.
      const dnu = new Date(Date.UTC(rok, m, 0)).getUTCDate();
      let kapacita = 0;
      for (let d = 1; d <= dnu; d += 1) {
        const denVTydnu = new Date(Date.UTC(rok, m - 1, d)).getUTCDay();
        const h = podleDne.get(denVTydnu);
        if (!h || h.byArrangement) continue;
        kapacita += Math.max(0, h.endMinutes - h.startMinutes);
      }
      mesice[m - 1].kapacitaMinut = kapacita;

      for (const u of nataceni) {
        if (u.studioId !== s.id) continue;
        const minut = prekryvMinut(u.start, u.end, zacatekMesice, konecMesice);
        if (minut <= 0) continue;
        mesice[m - 1].natoceno += minut;
        mesice[m - 1].pocet += 1;
      }
    }

    return {
      id: s.id,
      nazev: (s.shortName ?? s.name.split(' - ').pop() ?? s.name).trim(),
      barva: s.color,
      mesice,
      kapacitaMinut: mesice.reduce((a, m) => a + m.kapacitaMinut, 0),
      natoceno: mesice.reduce((a, m) => a + m.natoceno, 0),
      pocet: mesice.reduce((a, m) => a + m.pocet, 0),
    };
  });

  const celkem = prazdneMesice();
  for (const s of vysledek) {
    s.mesice.forEach((m, i) => {
      celkem[i].kapacitaMinut += m.kapacitaMinut;
      celkem[i].natoceno += m.natoceno;
      celkem[i].pocet += m.pocet;
    });
  }

  return { rok, studia: vysledek, celkem };
}

/** Obsazenost v procentech; bez kapacity (zavřené studio) vrací null. */
export function procenta(m: { kapacitaMinut: number; natoceno: number }): number | null {
  if (m.kapacitaMinut <= 0) return m.natoceno > 0 ? 100 : null;
  return Math.round((m.natoceno / m.kapacitaMinut) * 100);
}

/** Hodiny na jedno desetinné místo - do popisků. */
export function hodiny(minut: number): string {
  return (minut / 60).toLocaleString('cs-CZ', { maximumFractionDigits: minut % 60 === 0 ? 0 : 1 });
}
