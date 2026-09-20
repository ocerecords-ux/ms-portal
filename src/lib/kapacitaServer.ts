import { prisma } from '@/lib/db';
import { zonedToUtc } from '@/lib/calendar';

/**
 * KAPACITA STUDIÍ (zadání 20. 9. 2026 a jeho upřesnění: „potřebuji vidět
 * jasně, kolik a které dny z toho měsíce jsou obsazeny… studia jako sloupce a
 * pod nimi dny, vyznačit víkendy" → „chci to mít všechno na jedné stránce, ať
 * jasně vidím, kde jsou díry. A nemusí tam být ten počet hodin, jen
 * obdélníčky").
 *
 * Proto se počítá CELÝ ROK po dnech: dvanáct tabulek měsíců, v každé řádek =
 * den a sloupec = studio. Hodiny zůstávají jen v bublině po najetí myší.
 *
 * Den je navíc rozdělený na FREKVENCE (zadání 20. 9. 2026: „potřebuju ještě,
 * aby to bylo rozděleno na ranní a odpolední frekvence" - v tabulce, kterou
 * k tomu poslal, má každé studio sloupce 9-13 a 13-17). Okna se berou ze
 * zkratek studia (Administrace → Studia), a když studio žádné nemá, použijí
 * se běžné 9-13 a 13-17.
 *
 * Počítá se JEN NATÁČENÍ - potvrzené frekvence z nabídky a ručně zapsané
 * natáčení. Střih, casting, údržba, svátky ani dovolené ne: kapacita studia
 * je o tom, kolik hodin se v kabině dá točit.
 *
 * Kapacita dne = otevírací doba studia pro ten den v týdnu (Administrace →
 * Studia). Dny „jen po domluvě" (typicky víkendy) kapacitu nemají, ale když
 * se v nich točí, je to vidět - proto může měsíc vyjít přes 100 %.
 */

/** Jedna frekvence (ranní / odpolední) jednoho dne v jednom studiu. */
export type BunkaFrekvence = {
  /** Délka okna frekvence v minutách - podle ní se kreslí zaplněnost. */
  oknoMinut: number;
  /** Kolik z okna je v otevírací době; 0 = zavřeno nebo jen po domluvě. */
  kapacitaMinut: number;
  /** Minuty natáčení, které do okna spadají. */
  natoceno: number;
  /** Kolik natáčení se okna týká. */
  pocet: number;
};

/** Jeden den v jednom studiu. */
export type BunkaDne = {
  /** Minuty otevírací doby za celý den; 0 = zavřeno nebo jen po domluvě. */
  kapacitaMinut: number;
  /** Minuty natáčení, které do dne spadají (i mimo frekvence). */
  natoceno: number;
  /** Kolik natáčení se dne týká. */
  pocet: number;
  /** Ve stejném pořadí jako `frekvence` u studia. */
  casti: BunkaFrekvence[];
};

/** Okno frekvence ve studiu - sloupec v tabulce. */
export type Frekvence = {
  /** Popisek do záhlaví, třeba „9-13". */
  popis: string;
  /** Minuty od půlnoci. */
  od: number;
  do: number;
};

/** Když studio nemá zkratky, počítá se s běžnými dvěma frekvencemi. */
const VYCHOZI_FREKVENCE: Frekvence[] = [
  { popis: '9-13', od: 9 * 60, do: 13 * 60 },
  { popis: '13-17', od: 13 * 60, do: 17 * 60 },
];

/** „9-13" z minut od půlnoci; půlhodiny se vypíšou jako 9:30. */
function popisOkna(od: number, doo: number): string {
  const cas = (m: number) => (m % 60 === 0 ? `${Math.floor(m / 60)}` : `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`);
  return `${cas(od)}-${cas(doo)}`;
}

export type DenKapacity = {
  den: number;
  /** 0 = neděle, 6 = sobota. */
  denVTydnu: number;
  vikend: boolean;
  /** Ve stejném pořadí jako `studia`. */
  bunky: BunkaDne[];
};

export type MesicKapacity = {
  /** 1-12 */
  mesic: number;
  dny: DenKapacity[];
  kapacitaMinut: number;
  natoceno: number;
};

export type StudioSloupec = {
  id: string;
  nazev: string;
  barva: string;
  /** Sloupečky uvnitř studia - ranní a odpolední frekvence. */
  frekvence: Frekvence[];
  /** Součty za celý rok. */
  kapacitaMinut: number;
  natoceno: number;
  dnuSNatacenim: number;
};

export type KapacitaRoku = {
  rok: number;
  studia: StudioSloupec[];
  mesice: MesicKapacity[];
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

/**
 * Půlnoc daného dne v pásmu studia. `den` klidně přeteče (32. ledna je
 * 1. února) - Date.UTC to srovná za nás.
 */
function pulnoc(rok: number, mesic: number, den: number, pasmo: string): Date {
  const odhad = Date.UTC(rok, mesic - 1, den, 0, 0);
  const posun = posunPasma(new Date(odhad), pasmo);
  return new Date(odhad - posun * 60000);
}

/** Kolik dní má měsíc. */
export function dnuVMesici(rok: number, mesic: number): number {
  return new Date(Date.UTC(rok, mesic, 0)).getUTCDate();
}

type Hodiny = { weekday: number; startMinutes: number; endMinutes: number; byArrangement: boolean };
type Udalost = { studioId: string; start: Date; end: Date };

/** Natáčení ve studiích v daném rozsahu - potvrzené frekvence i ruční zápisy. */
async function nactiNataceni(od: Date, doKdy: Date): Promise<Udalost[]> {
  const [sloty, bloky] = await Promise.all([
    prisma.recordingSlot.findMany({
      where: { state: 'CONFIRMED', start: { lt: doKdy }, end: { gt: od } },
      select: { studioId: true, start: true, end: true },
    }),
    prisma.studioBlock.findMany({
      where: { kind: 'NATACENI', start: { lt: doKdy }, end: { gt: od } },
      select: { studioId: true, start: true, end: true },
    }),
  ]);
  return [...sloty, ...bloky];
}

/** Index prvního dne, který ještě končí po `kdy`. */
function najdiDen(hranice: Date[], kdy: Date): number {
  let nizko = 0;
  let vysoko = hranice.length - 2;
  while (nizko < vysoko) {
    const stred = (nizko + vysoko) >> 1;
    if (hranice[stred + 1].getTime() <= kdy.getTime()) nizko = stred + 1;
    else vysoko = stred;
  }
  return nizko;
}

/** Celý rok po dnech: dvanáct měsíců, v každém dny a v nich všechna studia. */
export async function nactiKapacituRoku(rok: number): Promise<KapacitaRoku> {
  const studia = await prisma.studio.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    include: { hours: true, presets: { orderBy: { sortOrder: 'asc' } } },
  });

  const nataceni = await nactiNataceni(
    new Date(Date.UTC(rok - 1, 11, 25)),
    new Date(Date.UTC(rok + 1, 0, 7)),
  );
  const podleStudia = new Map<string, Udalost[]>();
  for (const u of nataceni) {
    const seznam = podleStudia.get(u.studioId) ?? [];
    seznam.push(u);
    podleStudia.set(u.studioId, seznam);
  }

  const dnuVRoce = (new Date(Date.UTC(rok + 1, 0, 1)).getTime() - Date.UTC(rok, 0, 1)) / 86400000;
  const mesice: MesicKapacity[] = Array.from({ length: 12 }, (_, i) => ({
    mesic: i + 1,
    dny: Array.from({ length: dnuVMesici(rok, i + 1) }, (_, d) => {
      const denVTydnu = new Date(Date.UTC(rok, i, d + 1)).getUTCDay();
      return {
        den: d + 1,
        denVTydnu,
        vikend: denVTydnu === 0 || denVTydnu === 6,
        bunky: [] as BunkaDne[],
      };
    }),
    kapacitaMinut: 0,
    natoceno: 0,
  }));

  /** Den v roce podle pořadí → místo v tabulce měsíce. */
  const misto: { mesic: number; den: number }[] = [];
  for (let i = 0; i < dnuVRoce; i += 1) {
    const d = new Date(Date.UTC(rok, 0, 1 + i));
    misto.push({ mesic: d.getUTCMonth(), den: d.getUTCDate() - 1 });
  }

  const sloupce: StudioSloupec[] = studia.map((s) => {
    const hodinyDne = new Map<number, Hodiny>((s.hours as Hodiny[]).map((h) => [h.weekday, h]));
    // Zkratky studia = sloupečky frekvencí. Bez nich se počítá 9-13 a 13-17.
    const zkratky = s.presets as { label: string; startMinutes: number; endMinutes: number }[];
    const frekvence: Frekvence[] =
      zkratky.length > 0
        ? zkratky.map((z) => ({
            popis: popisOkna(z.startMinutes, z.endMinutes),
            od: z.startMinutes,
            do: z.endMinutes,
          }))
        : VYCHOZI_FREKVENCE;

    // Hranice dnů v pásmu studia - o jednu víc, ať má i poslední den konec.
    const hranice: Date[] = [];
    for (let i = 0; i <= dnuVRoce; i += 1) hranice.push(pulnoc(rok, 1, 1 + i, s.timezone));
    // Okna frekvencí po dnech, ve skutečném čase (kvůli letnímu času).
    const oknaDne: { od: Date; do: Date }[][] = misto.map((m) =>
      frekvence.map((f) => ({
        od: zonedToUtc(rok, m.mesic + 1, m.den + 1, f.od, s.timezone),
        do: zonedToUtc(rok, m.mesic + 1, m.den + 1, f.do, s.timezone),
      })),
    );

    const bunky: BunkaDne[] = misto.map((m, i) => {
      const denVTydnu = mesice[m.mesic].dny[m.den].denVTydnu;
      const h = hodinyDne.get(denVTydnu);
      const otevreno = Boolean(h) && !h!.byArrangement;
      const kapacita = otevreno ? Math.max(0, h!.endMinutes - h!.startMinutes) : 0;
      return {
        kapacitaMinut: kapacita,
        natoceno: 0,
        pocet: 0,
        casti: frekvence.map((f) => ({
          oknoMinut: Math.max(0, f.do - f.od),
          // Kapacitou okna je jen ta část, která padne do otevírací doby.
          kapacitaMinut: otevreno
            ? Math.max(0, Math.min(f.do, h!.endMinutes) - Math.max(f.od, h!.startMinutes))
            : 0,
          natoceno: 0,
          pocet: 0,
        })),
      };
    });

    for (const u of podleStudia.get(s.id) ?? []) {
      let i = najdiDen(hranice, u.start);
      while (i < bunky.length && hranice[i].getTime() < u.end.getTime()) {
        const minut = prekryvMinut(u.start, u.end, hranice[i], hranice[i + 1]);
        if (minut > 0) {
          bunky[i].natoceno += minut;
          bunky[i].pocet += 1;
          oknaDne[i].forEach((okno, k) => {
            const vOkne = prekryvMinut(u.start, u.end, okno.od, okno.do);
            if (vOkne <= 0) return;
            bunky[i].casti[k].natoceno += vOkne;
            bunky[i].casti[k].pocet += 1;
          });
        }
        i += 1;
      }
    }

    const sloupec: StudioSloupec = {
      id: s.id,
      nazev: (s.shortName ?? s.name.split(' - ').pop() ?? s.name).trim(),
      barva: s.color,
      frekvence,
      kapacitaMinut: 0,
      natoceno: 0,
      dnuSNatacenim: 0,
    };
    bunky.forEach((b, i) => {
      const m = misto[i];
      mesice[m.mesic].dny[m.den].bunky.push(b);
      mesice[m.mesic].kapacitaMinut += b.kapacitaMinut;
      mesice[m.mesic].natoceno += b.natoceno;
      sloupec.kapacitaMinut += b.kapacitaMinut;
      sloupec.natoceno += b.natoceno;
      if (b.natoceno > 0) sloupec.dnuSNatacenim += 1;
    });
    return sloupec;
  });

  return { rok, studia: sloupce, mesice };
}

/** Obsazenost v procentech; bez kapacity (zavřené studio) vrací null. */
export function procenta(m: { kapacitaMinut: number; natoceno: number }): number | null {
  if (m.kapacitaMinut <= 0) return m.natoceno > 0 ? 100 : null;
  return Math.round((m.natoceno / m.kapacitaMinut) * 100);
}

/** Hodiny na jedno desetinné místo - do bublin po najetí myší. */
export function hodiny(minut: number): string {
  return (minut / 60).toLocaleString('cs-CZ', { maximumFractionDigits: minut % 60 === 0 ? 0 : 1 });
}
