import type { WorkType } from '@prisma/client';
import { prisma } from '@/lib/db';
import { computeTotals } from '@/lib/doklady';
import { DEFAULT_BUDGET_SETTINGS, computeBudget, type BudgetSettingsValues } from '@/lib/budget';
import { durationMinutes, entryAmount } from '@/lib/timesheets';
import { STAV_ODEVZDANO, stavJeOdevzdany } from '@/lib/stavyProjektu';

/**
 * KNIHY, ROZPOČTY A ZISK (zadání 28. 9. 2026 pro Petera: „přehled celkový, na
 * kolik se vyčerpaly rozpočty, za co (střih, natáčení), aby si vyfiltroval
 * konkrétní lidi, kteří na tom pracovali, a jejich výkazy. Nastavit období
 * a pak jaké knihy se tento a minulý měsíc a další měsíce odevzdaly celkově."
 * + „aby bylo vidět zisk jasně z každé knihy oproti nákladům".)
 *
 * TŘI RŮZNÉ POHLEDY, KTERÉ SE NESMÍ SLÍT DOHROMADY:
 *
 *  1. PRÁCE ZA OBDOBÍ - výkazy zvukařů mezi `od` a `do`. Tohle se filtruje
 *     obdobím, člověkem a druhem práce; z toho jsou dlaždice, graf a tabulka
 *     lidí.
 *  2. ČERPÁNÍ ROZPOČTU - rozpočet je strop na CELOU knihu, ne na měsíc, takže
 *     se proti němu počítají výkazy za celou dobu projektu. Kdyby se čerpání
 *     ořezalo obdobím, vycházelo by u každé knihy pokaždé jinak a nikdy by
 *     neodpovídalo pravdě.
 *  3. ZISK KNIHY - tržba mínus náklady. Tržba jsou vydané faktury na projekt;
 *     když ještě žádná není, dopočítá se odhad z normostran a sazby klienta
 *     a je označený jako odhad. Náklady jsou výkazy (celkem) plus zařazené
 *     výdaje navázané na projekt.
 *
 * MĚNY A JEDNOTKY. Výkazy a rozpočty se v portálu drží v CELÝCH KORUNÁCH,
 * doklady v nejmenší jednotce (haléře). Tady se všechno převádí na celé
 * koruny hned při načtení, ať se v žádném součtu nepotkají dvě různé jednotky.
 * Cizí měna se přepočítá kurzem, který si doklad nese od vystavení.
 *
 * CO JE „ODEVZDANÁ KNIHA". Okamžik, kdy projekt poprvé přešel do stavu
 * „Dokončeno - ke schválení" (rozhodnuto 28. 9. 2026). Portál ho zná z historie
 * projektu (`ProjektUdalost`), kterou vede od 10. 9. 2026. U starších knih
 * historie není, takže se sáhne po datu dokončení u projektu - a takový řádek
 * je označený, ať se nezamění za změřený údaj.
 */

export type DruhFiltr = WorkType | null;

export type KnihyFiltr = {
  /** Včetně. */
  od: Date;
  /** Bez - první den PO období. */
  do: Date;
  /** Id zvukaře, nebo null pro všechny. */
  kdo: string | null;
  druh: DruhFiltr;
};

export type CastkaDruhu = { hodiny: number; castka: number };

export type Mesic = {
  klic: string;
  popis: string;
  nataceni: number;
  strih: number;
  ostatni: number;
  /** Kolik knih se v tom měsíci odevzdalo. */
  knih: number;
};

export type Clovek = {
  id: string;
  jmeno: string;
  hodiny: number;
  castka: number;
  nataceni: number;
  strih: number;
  ostatni: number;
  /** Na kolika různých projektech v období pracoval. */
  projektu: number;
};

export type Vykaz = {
  id: string;
  datum: Date;
  jmeno: string;
  druh: WorkType;
  projekt: string | null;
  projektId: string | null;
  minut: number;
  castka: number;
  poznamka: string | null;
};

export type Kniha = {
  id: string;
  nazev: string;
  klient: string | null;
  stav: string | null;
  normostran: number;
  /** Strop z rozpočtu - celá kniha. */
  rozpocet: number;
  /** Výkazy za celou dobu projektu. */
  vycerpano: number;
  /** Z toho spadá do vybraného období. */
  vObdobi: number;
  /** Zařazené výdaje navázané na projekt. */
  vydaje: number;
  /** Výkazy celkem + výdaje. */
  naklady: number;
  trzba: number;
  /** Tržba je jen odhad z normostran - faktura zatím žádná není. */
  trzbaOdhad: boolean;
  zisk: number;
  odevzdanoAt: Date | null;
  /** Datum odevzdání pochází z data dokončení, ne z historie projektu. */
  odevzdanoOdhad: boolean;
};

export type OdevzdanyMesic = {
  klic: string;
  popis: string;
  knihy: { id: string; nazev: string; klient: string | null; datum: Date; odhad: boolean }[];
};

export type KnihyPrehled = {
  souhrn: {
    hodiny: number;
    castka: number;
    nataceni: CastkaDruhu;
    strih: CastkaDruhu;
    ostatni: CastkaDruhu;
    knih: number;
    vykazu: number;
  };
  mesice: Mesic[];
  lide: Clovek[];
  vykazy: Vykaz[];
  knihy: Kniha[];
  odevzdane: OdevzdanyMesic[];
  /** Zvukaři do výběru - všichni, kdo za období něco vykázali. */
  zvukari: { id: string; jmeno: string }[];
};

const MESICE = [
  'leden',
  'únor',
  'březen',
  'duben',
  'květen',
  'červen',
  'červenec',
  'srpen',
  'září',
  'říjen',
  'listopad',
  'prosinec',
];
const MESICE_KRATCE = ['led', 'úno', 'bře', 'dub', 'kvě', 'čvn', 'čvc', 'srp', 'zář', 'říj', 'lis', 'pro'];

function klicMesice(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Všechny měsíce období, i prázdné - graf nesmí přeskočit měsíc bez práce. */
function prazdneMesice(od: Date, doData: Date, vicLet: boolean): Mesic[] {
  const radky: Mesic[] = [];
  const d = new Date(Date.UTC(od.getUTCFullYear(), od.getUTCMonth(), 1));
  while (d < doData) {
    radky.push({
      klic: klicMesice(d),
      popis: vicLet
        ? `${MESICE_KRATCE[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(2)}`
        : MESICE_KRATCE[d.getUTCMonth()],
      nataceni: 0,
      strih: 0,
      ostatni: 0,
      knih: 0,
    });
    d.setUTCMonth(d.getUTCMonth() + 1);
  }
  return radky;
}

function popisMesice(klic: string): string {
  const [rok, mesic] = klic.split('-');
  return `${MESICE[Number(mesic) - 1]} ${rok}`;
}

/** Jméno bez titulů před ním - v tabulce zabíraly půl sloupce. */
function jmeno(u: { name: string | null; email: string }): string {
  return (u.name || u.email).trim();
}

export async function nactiKnihyPrehled(f: KnihyFiltr): Promise<KnihyPrehled> {
  const vicLet = f.od.getUTCFullYear() !== new Date(f.do.getTime() - 1).getUTCFullYear();

  const [vykazyObdobi, lidiObdobi, nastaveni, projekty] = await Promise.all([
    prisma.timesheetEntry.findMany({
      where: {
        date: { gte: f.od, lt: f.do },
        ...(f.kdo ? { userId: f.kdo } : {}),
        ...(f.druh ? { workType: f.druh } : {}),
      },
      orderBy: [{ date: 'desc' }, { startMinutes: 'desc' }],
      select: {
        id: true,
        date: true,
        startMinutes: true,
        endMinutes: true,
        workType: true,
        caflouProjectId: true,
        projectName: true,
        hourlyRateSnapshot: true,
        note: true,
        userId: true,
        user: { select: { name: true, email: true } },
      },
    }),
    /**
     * Kdo do výběru lidí. Schválně VLASTNÍ dotaz bez filtrů: kdyby se seznam
     * skládal z už odfiltrovaných výkazů, zbyl by po vybrání člověka v nabídce
     * jen on sám a nešlo by přepnout na někoho jiného.
     */
    prisma.timesheetEntry.findMany({
      where: { date: { gte: f.od, lt: f.do } },
      distinct: ['userId'],
      select: { userId: true, user: { select: { name: true, email: true } } },
    }),
    prisma.budgetSettings.findUnique({ where: { id: 'default' } }),
    /**
     * KNIHY = projekty s počtem normostran u klienta, který dělá audioknihy.
     * Stejné pravidlo jako v detailu projektu, aby se rozpočet nepočítal
     * jednou tady a jinak tam.
     */
    prisma.projectMeta.findMany({
      where: { pageCount: { gt: 0 }, company: { dealsAudiobooks: true } },
      select: {
        caflouProjectId: true,
        name: true,
        statusName: true,
        pageCount: true,
        endDate: true,
        companyName: true,
        company: { select: { name: true, ratePerPage: true } },
      },
    }),
  ]);

  const settings: BudgetSettingsValues = nastaveni ?? DEFAULT_BUDGET_SETTINGS;
  const idKnih = projekty.map((p) => p.caflouProjectId);

  const [vykazyKnih, faktury, vydaje, udalosti] = await Promise.all([
    /** Čerpání rozpočtu se počítá za celou dobu projektu - viz poznámka nahoře. */
    idKnih.length
      ? prisma.timesheetEntry.findMany({
          where: { caflouProjectId: { in: idKnih } },
          select: {
            caflouProjectId: true,
            startMinutes: true,
            endMinutes: true,
            hourlyRateSnapshot: true,
          },
        })
      : Promise.resolve([]),
    idKnih.length
      ? prisma.invoice.findMany({
          where: { caflouProjectId: { in: idKnih }, status: { in: ['SENT', 'PAID'] } },
          select: {
            caflouProjectId: true,
            exchangeRate: true,
            slevaProcent: true,
            slevaMinor: true,
            items: { select: { quantity: true, unitPriceMinor: true, vatRate: true } },
          },
        })
      : Promise.resolve([]),
    idKnih.length
      ? prisma.expense.findMany({
          where: { caflouProjectId: { in: idKnih }, stav: 'ZARAZENY' },
          select: { caflouProjectId: true, amountExVatMinor: true, exchangeRate: true },
        })
      : Promise.resolve([]),
    /**
     * Kdy kniha poprvé odešla klientovi. Bere se NEJSTARŠÍ přechod do stavu
     * „Dokončeno - ke schválení" - projekt se do něj může vrátit po opravách
     * a odevzdání by se pak počítalo dvakrát.
     */
    idKnih.length
      ? prisma.projektUdalost.findMany({
          where: { caflouProjectId: { in: idKnih }, pole: 'statusName', nova: STAV_ODEVZDANO },
          orderBy: { createdAt: 'asc' },
          select: { caflouProjectId: true, createdAt: true },
        })
      : Promise.resolve([]),
  ]);

  // --- Práce za období -----------------------------------------------------

  const mesice = prazdneMesice(f.od, f.do, vicLet);
  const podleKlice = new Map(mesice.map((m) => [m.klic, m]));
  const souhrn = {
    hodiny: 0,
    castka: 0,
    nataceni: { hodiny: 0, castka: 0 },
    strih: { hodiny: 0, castka: 0 },
    ostatni: { hodiny: 0, castka: 0 },
    knih: 0,
    vykazu: vykazyObdobi.length,
  };
  const lide = new Map<string, Clovek & { projekty: Set<string> }>();
  const vObdobiPodleProjektu = new Map<string, number>();

  for (const v of vykazyObdobi) {
    const minut = durationMinutes(v.startMinutes, v.endMinutes);
    const hodiny = minut / 60;
    const castka = entryAmount(v.startMinutes, v.endMinutes, v.hourlyRateSnapshot);
    const kdo = jmeno(v.user);

    souhrn.hodiny += hodiny;
    souhrn.castka += castka;
    const kos =
      v.workType === 'RECORDING' ? souhrn.nataceni : v.workType === 'EDITING' ? souhrn.strih : souhrn.ostatni;
    kos.hodiny += hodiny;
    kos.castka += castka;

    const m = podleKlice.get(klicMesice(v.date));
    if (m) {
      if (v.workType === 'RECORDING') m.nataceni += castka;
      else if (v.workType === 'EDITING') m.strih += castka;
      else m.ostatni += castka;
    }

    let c = lide.get(v.userId);
    if (!c) {
      c = {
        id: v.userId,
        jmeno: kdo,
        hodiny: 0,
        castka: 0,
        nataceni: 0,
        strih: 0,
        ostatni: 0,
        projektu: 0,
        projekty: new Set<string>(),
      };
      lide.set(v.userId, c);
    }
    c.hodiny += hodiny;
    c.castka += castka;
    if (v.workType === 'RECORDING') c.nataceni += castka;
    else if (v.workType === 'EDITING') c.strih += castka;
    else c.ostatni += castka;
    if (v.caflouProjectId) {
      c.projekty.add(v.caflouProjectId);
      vObdobiPodleProjektu.set(
        v.caflouProjectId,
        (vObdobiPodleProjektu.get(v.caflouProjectId) ?? 0) + castka,
      );
    }
  }

  // --- Čerpání, tržby a náklady po knihách --------------------------------

  const vycerpanoCelkem = new Map<string, number>();
  for (const v of vykazyKnih) {
    if (!v.caflouProjectId) continue;
    vycerpanoCelkem.set(
      v.caflouProjectId,
      (vycerpanoCelkem.get(v.caflouProjectId) ?? 0) +
        entryAmount(v.startMinutes, v.endMinutes, v.hourlyRateSnapshot),
    );
  }

  const trzby = new Map<string, number>();
  for (const fa of faktury) {
    if (!fa.caflouProjectId) continue;
    // Doklady jsou v haléřích, výkazy v korunách - tady se to srovná.
    const castka = Math.round(
      (computeTotals(fa.items, { slevaProcent: fa.slevaProcent, slevaMinor: fa.slevaMinor }).exVat *
        (fa.exchangeRate || 1)) /
        100,
    );
    trzby.set(fa.caflouProjectId, (trzby.get(fa.caflouProjectId) ?? 0) + castka);
  }

  const naklady = new Map<string, number>();
  for (const v of vydaje) {
    if (!v.caflouProjectId) continue;
    const castka = Math.round((v.amountExVatMinor * (v.exchangeRate || 1)) / 100);
    naklady.set(v.caflouProjectId, (naklady.get(v.caflouProjectId) ?? 0) + castka);
  }

  const odevzdano = new Map<string, Date>();
  for (const u of udalosti) {
    // Řazené od nejstarší, takže první zápis je ten pravý.
    if (!odevzdano.has(u.caflouProjectId)) odevzdano.set(u.caflouProjectId, u.createdAt);
  }

  const knihy: Kniha[] = projekty.map((p) => {
    const rozpocet = computeBudget(p.pageCount ?? 0, settings);
    const vycerpano = vycerpanoCelkem.get(p.caflouProjectId) ?? 0;
    const vydajeKnihy = naklady.get(p.caflouProjectId) ?? 0;
    const trzbaFaktur = trzby.get(p.caflouProjectId) ?? 0;
    const sazba = p.company?.ratePerPage ?? null;
    const trzbaOdhad = trzbaFaktur === 0 && sazba != null && sazba > 0;
    const trzba = trzbaOdhad ? (p.pageCount ?? 0) * (sazba as number) : trzbaFaktur;
    const nakladyKnihy = vycerpano + vydajeKnihy;

    const zHistorie = odevzdano.get(p.caflouProjectId) ?? null;
    // Záloha pro knihy odevzdané dřív, než portál vedl historii projektu.
    const odevzdanoOdhad = !zHistorie && Boolean(p.endDate) && stavJeOdevzdany(p.statusName);

    return {
      id: p.caflouProjectId,
      nazev: p.name || `Projekt ${p.caflouProjectId}`,
      klient: p.company?.name ?? p.companyName ?? null,
      stav: p.statusName,
      normostran: p.pageCount ?? 0,
      rozpocet: rozpocet.total,
      vycerpano,
      vObdobi: vObdobiPodleProjektu.get(p.caflouProjectId) ?? 0,
      vydaje: vydajeKnihy,
      naklady: nakladyKnihy,
      trzba,
      trzbaOdhad,
      zisk: trzba - nakladyKnihy,
      odevzdanoAt: zHistorie ?? (odevzdanoOdhad ? p.endDate : null),
      odevzdanoOdhad,
    };
  });

  // --- Odevzdané knihy po měsících ----------------------------------------

  const poMesicich = new Map<string, OdevzdanyMesic>();
  for (const k of knihy) {
    if (!k.odevzdanoAt) continue;
    if (k.odevzdanoAt < f.od || k.odevzdanoAt >= f.do) continue;
    const klic = klicMesice(k.odevzdanoAt);
    let m = poMesicich.get(klic);
    if (!m) {
      m = { klic, popis: popisMesice(klic), knihy: [] };
      poMesicich.set(klic, m);
    }
    m.knihy.push({
      id: k.id,
      nazev: k.nazev,
      klient: k.klient,
      datum: k.odevzdanoAt,
      odhad: k.odevzdanoOdhad,
    });
    const graf = podleKlice.get(klic);
    if (graf) graf.knih += 1;
    souhrn.knih += 1;
  }
  for (const m of poMesicich.values()) m.knihy.sort((a, b) => a.datum.getTime() - b.datum.getTime());

  /**
   * V TABULCE JSOU JEN KNIHY, KTERÝCH SE OBDOBÍ TÝKÁ - buď se v něm odevzdaly,
   * nebo se na nich v něm pracovalo. Vypsat všechny audioknihy od začátku by
   * z výběru období udělalo ozdobu.
   */
  const vTabulce = knihy
    .filter((k) => k.vObdobi > 0 || (k.odevzdanoAt && k.odevzdanoAt >= f.od && k.odevzdanoAt < f.do))
    .sort((a, b) => {
      const ka = a.odevzdanoAt?.getTime() ?? 0;
      const kb = b.odevzdanoAt?.getTime() ?? 0;
      return kb - ka || b.vObdobi - a.vObdobi || a.nazev.localeCompare(b.nazev, 'cs');
    });

  return {
    souhrn,
    mesice,
    lide: Array.from(lide.values())
      .map(({ projekty, ...c }) => ({ ...c, projektu: projekty.size }))
      .sort((a, b) => b.castka - a.castka),
    vykazy: vykazyObdobi.map((v) => ({
      id: v.id,
      datum: v.date,
      jmeno: jmeno(v.user),
      druh: v.workType,
      projekt: v.projectName,
      projektId: v.caflouProjectId,
      minut: durationMinutes(v.startMinutes, v.endMinutes),
      castka: entryAmount(v.startMinutes, v.endMinutes, v.hourlyRateSnapshot),
      poznamka: v.note,
    })),
    knihy: vTabulce,
    odevzdane: Array.from(poMesicich.values()).sort((a, b) => b.klic.localeCompare(a.klic)),
    zvukari: lidiObdobi
      .map((l) => ({ id: l.userId, jmeno: jmeno(l.user) }))
      .sort((a, b) => a.jmeno.localeCompare(b.jmeno, 'cs')),
  };
}

/** Od kterého roku jsou v portálu výkazy - do výběru roku. */
export async function prvniRokVykazu(): Promise<number> {
  const prvni = await prisma.timesheetEntry.findFirst({ orderBy: { date: 'asc' }, select: { date: true } });
  return prvni ? prvni.date.getUTCFullYear() : new Date().getUTCFullYear();
}
