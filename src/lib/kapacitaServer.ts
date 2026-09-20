import { prisma } from '@/lib/db';

/**
 * KAPACITA STUDIÍ (zadání 20. 9. 2026, upřesnění téhož dne: „potřebuji vidět
 * jasně, kolik a které dny z toho měsíce jsou obsazeny. Takže spíš jednotlivá
 * studia jako sloupce a pod nimi dny. Vyznačit víkendy").
 *
 * Přehled je proto po DNECH jednoho měsíce: řádek = den, sloupec = studio.
 * Vedle toho se počítá i celý rok, ale jen jako proužek měsíců nahoře, aby
 * bylo vidět, kam v roce skočit.
 *
 * Počítá se JEN NATÁČENÍ - potvrzené frekvence z nabídky a ručně zapsané
 * natáčení. Střih, casting, údržba, svátky ani dovolené ne: kapacita studia
 * je o tom, kolik hodin se v kabině dá točit.
 *
 * Kapacita dne = otevírací doba studia pro ten den v týdnu (Administrace →
 * Studia). Dny „jen po domluvě" (typicky víkendy) kapacitu nemají, ale když
 * se v nich točí, natočené hodiny se ukážou - proto může měsíc vyjít přes
 * 100 %.
 */

/** Jeden den v jednom studiu. */
export type BunkaDne = {
  studioId: string;
  /** Minuty otevírací doby; 0 = zavřeno nebo jen po domluvě. */
  kapacitaMinut: number;
  /** Minuty natáčení, které do dne spadají. */
  natoceno: number;
  /** Kolik natáčení se dne týká. */
  pocet: number;
  /** Den „jen po domluvě" - kapacita se nepočítá, točit se v něm dá. */
  poDomluve: boolean;
};

export type DenKapacity = {
  /** YYYY-MM-DD */
  datum: string;
  den: number;
  /** 0 = neděle, 6 = sobota. */
  denVTydnu: number;
  vikend: boolean;
  bunky: BunkaDne[];
};

export type StudioSloupec = {
  id: string;
  nazev: string;
  barva: string;
  /** Součty za zobrazený měsíc. */
  kapacitaMinut: number;
  natoceno: number;
  pocet: number;
  /** V kolika dnech měsíce se v tom studiu točilo. */
  dnuSNatacenim: number;
};

export type MesicRoku = {
  /** 1-12 */
  mesic: number;
  kapacitaMinut: number;
  natoceno: number;
};

export type KapacitaMesice = {
  rok: number;
  mesic: number;
  studia: StudioSloupec[];
  dny: DenKapacity[];
  /** Proužek celého roku nad tabulkou - přes všechna studia. */
  rokPoMesicich: MesicRoku[];
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

/** Kolik dní má měsíc. */
export function dnuVMesici(rok: number, mesic: number): number {
  return new Date(Date.UTC(rok, mesic, 0)).getUTCDate();
}

type Hodiny = { weekday: number; startMinutes: number; endMinutes: number; byArrangement: boolean };
type Udalost = { studioId: string; start: Date; end: Date };

/** Otevírací doba studia po dnech v týdnu. */
function otviraci(hours: Hodiny[]): Map<number, Hodiny> {
  return new Map(hours.map((h) => [h.weekday, h]));
}

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

/**
 * Měsíc po dnech. Vrací sloupce (studia), řádky (dny) a k tomu proužek
 * celého roku, aby šlo přeskočit na vytížený měsíc.
 */
export async function nactiKapacituMesice(rok: number, mesic: number): Promise<KapacitaMesice> {
  const studia = await prisma.studio.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    include: { hours: true },
  });

  // Rok se načítá celý - proužek měsíců nad tabulkou z něj žije a je to
  // jedno kolečko do databáze navíc, ne dvanáct.
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

  const pocetDnu = dnuVMesici(rok, mesic);
  const dny: DenKapacity[] = Array.from({ length: pocetDnu }, (_, i) => {
    const den = i + 1;
    const denVTydnu = new Date(Date.UTC(rok, mesic - 1, den)).getUTCDay();
    return {
      datum: `${rok}-${String(mesic).padStart(2, '0')}-${String(den).padStart(2, '0')}`,
      den,
      denVTydnu,
      vikend: denVTydnu === 0 || denVTydnu === 6,
      bunky: [],
    };
  });

  const sloupce: StudioSloupec[] = [];
  const rokPoMesicich: MesicRoku[] = Array.from({ length: 12 }, (_, i) => ({
    mesic: i + 1,
    kapacitaMinut: 0,
    natoceno: 0,
  }));

  for (const s of studia) {
    const hodiny = otviraci(s.hours as Hodiny[]);
    const udalosti = podleStudia.get(s.id) ?? [];
    const sloupec: StudioSloupec = {
      id: s.id,
      nazev: (s.shortName ?? s.name.split(' - ').pop() ?? s.name).trim(),
      barva: s.color,
      kapacitaMinut: 0,
      natoceno: 0,
      pocet: 0,
      dnuSNatacenim: 0,
    };

    // Zobrazený měsíc den po dni.
    for (const den of dny) {
      const zacatek = pulnoc(rok, mesic, den.den, s.timezone);
      const konec = pulnoc(rok, mesic, den.den + 1, s.timezone);
      const h = hodiny.get(den.denVTydnu);
      const poDomluve = h?.byArrangement ?? false;
      const kapacita = !h || poDomluve ? 0 : Math.max(0, h.endMinutes - h.startMinutes);

      let natoceno = 0;
      let pocet = 0;
      for (const u of udalosti) {
        const minut = prekryvMinut(u.start, u.end, zacatek, konec);
        if (minut <= 0) continue;
        natoceno += minut;
        pocet += 1;
      }

      den.bunky.push({ studioId: s.id, kapacitaMinut: kapacita, natoceno, pocet, poDomluve });
      sloupec.kapacitaMinut += kapacita;
      sloupec.natoceno += natoceno;
      sloupec.pocet += pocet;
      if (natoceno > 0) sloupec.dnuSNatacenim += 1;
    }

    // Proužek roku - stejný výpočet, jen bez podrobností po dnech.
    for (let m = 1; m <= 12; m += 1) {
      const dnu = dnuVMesici(rok, m);
      for (let d = 1; d <= dnu; d += 1) {
        const denVTydnu = new Date(Date.UTC(rok, m - 1, d)).getUTCDay();
        const h = hodiny.get(denVTydnu);
        if (h && !h.byArrangement) {
          rokPoMesicich[m - 1].kapacitaMinut += Math.max(0, h.endMinutes - h.startMinutes);
        }
      }
      const zacatek = pulnoc(rok, m, 1, s.timezone);
      const konec = m === 12 ? pulnoc(rok + 1, 1, 1, s.timezone) : pulnoc(rok, m + 1, 1, s.timezone);
      for (const u of udalosti) {
        rokPoMesicich[m - 1].natoceno += prekryvMinut(u.start, u.end, zacatek, konec);
      }
    }

    sloupce.push(sloupec);
  }

  return { rok, mesic, studia: sloupce, dny, rokPoMesicich };
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
