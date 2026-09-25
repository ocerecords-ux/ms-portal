import { prisma } from '@/lib/db';
import { computeTotals } from '@/lib/doklady';

/**
 * OBRAT A ZISK (zadání 21. 9. 2026: „chci do přehledu novou záložku, kde
 * uvidím celkový obrat a zisk i s grafy a možnostmi výběru").
 *
 * Všechno se počítá BEZ DPH a v korunách - cizí měna se přepočte kurzem ČNB,
 * který si doklad nese od vystavení. DPH se odvádí/odečítá, do obratu ani
 * nákladů nepatří.
 *
 *  - Obrat = vydané faktury (odeslané nebo uhrazené; rozpracované a stornované
 *    ne). Datum je DUZP, a když chybí, datum vystavení.
 *  - Náklady = výdaje zařazené mezi výdaje (nezařazené ze schránky ještě ne).
 *  - Zisk = obrat - náklady.
 *
 * Varianta „uhrazeno" počítá peníze, které opravdu přišly/odešly: fakturu
 * podle data úhrady, výdaj jen uhrazený a podle data úhrady.
 */

export type Zaklad = 'vystaveno' | 'uhrazeno';
export type Krok = 'mesic' | 'ctvrtleti';

export type FinanceFiltr = {
  od: Date; // včetně
  do: Date; // bez
  firma: string | null;
  zaklad: Zaklad;
  krok: Krok;
};

export type Useky = { klic: string; popis: string; obrat: number; naklady: number; zisk: number }[];

export type FinancePrehled = {
  useky: Useky;
  souhrn: { obrat: number; naklady: number; zisk: number; faktur: number; vydaju: number };
  predchozi: { obrat: number; naklady: number; zisk: number };
  kategorie: { nazev: string; castka: number }[];
  klienti: { nazev: string; obrat: number }[];
  projekty: { id: string; nazev: string; obrat: number; naklady: number; zisk: number }[];
};

const MESICE_KRATCE = ['led', 'úno', 'bře', 'dub', 'kvě', 'čvn', 'čvc', 'srp', 'zář', 'říj', 'lis', 'pro'];

function klicUseku(d: Date, krok: Krok): string {
  const r = d.getUTCFullYear();
  const m = d.getUTCMonth();
  return krok === 'mesic' ? `${r}-${String(m + 1).padStart(2, '0')}` : `${r}-Q${Math.floor(m / 3) + 1}`;
}

/** Všechny úseky mezi od a do, i prázdné - graf nesmí přeskočit měsíc bez dokladu. */
function prazdneUseky(od: Date, doData: Date, krok: Krok): Useky {
  const useky: Useky = [];
  const d = new Date(Date.UTC(od.getUTCFullYear(), od.getUTCMonth(), 1));
  const videne = new Set<string>();
  const vicLet = od.getUTCFullYear() !== new Date(doData.getTime() - 1).getUTCFullYear();
  while (d < doData) {
    const klic = klicUseku(d, krok);
    if (!videne.has(klic)) {
      videne.add(klic);
      const rok = d.getUTCFullYear();
      const popis =
        krok === 'mesic'
          ? `${MESICE_KRATCE[d.getUTCMonth()]}${vicLet ? ` ${String(rok).slice(2)}` : ''}`
          : `Q${Math.floor(d.getUTCMonth() / 3) + 1}${vicLet ? ` ${String(rok).slice(2)}` : ''}`;
      useky.push({ klic, popis, obrat: 0, naklady: 0, zisk: 0 });
    }
    d.setUTCMonth(d.getUTCMonth() + 1);
  }
  return useky;
}

/** Stejně dlouhé období těsně před zvoleným - kvůli srovnání. */
export function predchoziObdobi(od: Date, doData: Date): { od: Date; do: Date } {
  const mesicu =
    (doData.getUTCFullYear() - od.getUTCFullYear()) * 12 + (doData.getUTCMonth() - od.getUTCMonth());
  const pOd = new Date(Date.UTC(od.getUTCFullYear(), od.getUTCMonth() - mesicu, 1));
  return { od: pOd, do: od };
}

export async function nactiFinance(f: FinanceFiltr): Promise<FinancePrehled> {
  const pred = predchoziObdobi(f.od, f.do);
  const rozsah = { gte: pred.od, lt: f.do };
  const firma = f.firma ? { issuerCompanyId: f.firma } : {};

  const [faktury, vydaje] = await Promise.all([
    prisma.invoice.findMany({
      where:
        f.zaklad === 'uhrazeno'
          ? { ...firma, status: 'PAID', paidAt: rozsah }
          : {
              ...firma,
              status: { in: ['SENT', 'PAID'] },
              OR: [{ taxDate: rozsah }, { taxDate: null, issueDate: rozsah }],
            },
      select: {
        issueDate: true,
        taxDate: true,
        paidAt: true,
        exchangeRate: true,
        slevaProcent: true,
        slevaMinor: true,
        caflouProjectId: true,
        projectName: true,
        company: { select: { name: true } },
        items: { select: { quantity: true, unitPriceMinor: true, vatRate: true } },
      },
    }),
    prisma.expense.findMany({
      /**
       * ČÁSTEČNÉ ÚHRADY SE POČÍTAJÍ PO ČÁSTECH (zadání 25. 9. 2026: „ano,
       * počítej jednotlivé úhrady"). V režimu „Uhrazeno" tedy hledáme doklady,
       * u kterých v období odešly peníze - buď zapsanou úhradou, nebo (u
       * starších dokladů bez jediné úhrady) překlopením na zaplaceno.
       */
      where:
        f.zaklad === 'uhrazeno'
          ? {
              ...firma,
              stav: 'ZARAZENY',
              OR: [{ paid: true, paidAt: rozsah }, { uhrady: { some: { datum: rozsah } } }],
            }
          : { ...firma, stav: 'ZARAZENY', issueDate: rozsah },
      select: {
        issueDate: true,
        paidAt: true,
        paid: true,
        amountExVatMinor: true,
        vatRate: true,
        exchangeRate: true,
        caflouProjectId: true,
        projectName: true,
        category: { select: { name: true } },
        uhrady: { select: { castkaMinor: true, datum: true } },
      },
    }),
  ]);

  const useky = prazdneUseky(f.od, f.do, f.krok);
  const podleKlice = new Map(useky.map((u) => [u.klic, u]));
  const souhrn = { obrat: 0, naklady: 0, zisk: 0, faktur: 0, vydaju: 0 };
  const predchozi = { obrat: 0, naklady: 0, zisk: 0 };
  const kategorie = new Map<string, number>();
  const klienti = new Map<string, number>();
  const projekty = new Map<string, { id: string; nazev: string; obrat: number; naklady: number }>();

  const vObdobi = (d: Date) => d >= f.od && d < f.do;
  const projekt = (id: string | null, nazev: string | null) => {
    if (!id) return null;
    let p = projekty.get(id);
    if (!p) {
      p = { id, nazev: nazev || `Projekt ${id}`, obrat: 0, naklady: 0 };
      projekty.set(id, p);
    }
    return p;
  };

  for (const fa of faktury) {
    const datum = f.zaklad === 'uhrazeno' ? fa.paidAt : (fa.taxDate ?? fa.issueDate);
    if (!datum) continue;
    const castka = Math.round(
      computeTotals(fa.items, { slevaProcent: fa.slevaProcent, slevaMinor: fa.slevaMinor }).exVat *
        (fa.exchangeRate || 1),
    );
    if (!vObdobi(datum)) {
      predchozi.obrat += castka;
      continue;
    }
    souhrn.obrat += castka;
    souhrn.faktur += 1;
    const u = podleKlice.get(klicUseku(datum, f.krok));
    if (u) u.obrat += castka;
    const klient = fa.company?.name || '—';
    klienti.set(klient, (klienti.get(klient) ?? 0) + castka);
    const p = projekt(fa.caflouProjectId, fa.projectName);
    if (p) p.obrat += castka;
  }

  for (const v of vydaje) {
    /**
     * JEDEN DOKLAD = JEDNA NEBO VÍC ČÁSTEK (25. 9. 2026). Ve „Vystaveno" je
     * to celý doklad ke dni dokladu; v „Uhrazeno" každá zapsaná úhrada ke dni,
     * kdy peníze odešly. Doklad bez jediné zapsané úhrady se čte postaru -
     * celá částka ke dni, kdy ho někdo označil jako uhrazený.
     *
     * ÚHRADA JE S DPH, náklady se počítají BEZ DPH, takže se každá částka
     * přepočítá poměrem základu k celku - půlka faktury je půlka nákladu.
     */
    const kurz = v.exchangeRate || 1;
    const celkemSDph = v.amountExVatMinor + Math.round((v.amountExVatMinor * v.vatRate) / 100);
    const podilBezDph = celkemSDph > 0 ? v.amountExVatMinor / celkemSDph : 1;

    const castiky: { datum: Date; castka: number }[] =
      f.zaklad !== 'uhrazeno'
        ? [{ datum: v.issueDate, castka: Math.round(v.amountExVatMinor * kurz) }]
        : v.uhrady.length > 0
          ? v.uhrady.map((u) => ({
              datum: u.datum,
              castka: Math.round(u.castkaMinor * podilBezDph * kurz),
            }))
          : v.paid && v.paidAt
            ? [{ datum: v.paidAt, castka: Math.round(v.amountExVatMinor * kurz) }]
            : [];

    let zapocten = false;
    for (const cast of castiky) {
      if (!cast.datum || cast.castka === 0) continue;
      if (!vObdobi(cast.datum)) {
        predchozi.naklady += cast.castka;
        continue;
      }
      souhrn.naklady += cast.castka;
      if (!zapocten) {
        // Doklad se do počtu započítá jednou, i když se platil třikrát.
        souhrn.vydaju += 1;
        zapocten = true;
      }
      const u = podleKlice.get(klicUseku(cast.datum, f.krok));
      if (u) u.naklady += cast.castka;
      const k = v.category?.name || 'Bez kategorie';
      kategorie.set(k, (kategorie.get(k) ?? 0) + cast.castka);
      const p = projekt(v.caflouProjectId, v.projectName);
      if (p) p.naklady += cast.castka;
    }
  }

  for (const u of useky) u.zisk = u.obrat - u.naklady;
  souhrn.zisk = souhrn.obrat - souhrn.naklady;
  predchozi.zisk = predchozi.obrat - predchozi.naklady;

  const serad = (m: Map<string, number>) =>
    Array.from(m.entries())
      .map(([nazev, castka]) => ({ nazev, castka }))
      .sort((a, b) => b.castka - a.castka);

  return {
    useky,
    souhrn,
    predchozi,
    kategorie: serad(kategorie),
    klienti: serad(klienti).map((k) => ({ nazev: k.nazev, obrat: k.castka })),
    projekty: Array.from(projekty.values())
      .map((p) => ({ ...p, zisk: p.obrat - p.naklady }))
      .sort((a, b) => b.obrat - a.obrat || b.naklady - a.naklady),
  };
}

/** Od kterého roku jsou v portálu doklady - do výběru roku. */
export async function prvniRokDokladu(): Promise<number> {
  const [fa, vy] = await Promise.all([
    prisma.invoice.findFirst({ orderBy: { issueDate: 'asc' }, select: { issueDate: true } }),
    prisma.expense.findFirst({ orderBy: { issueDate: 'asc' }, select: { issueDate: true } }),
  ]);
  const roky = [fa?.issueDate, vy?.issueDate].filter((d): d is Date => Boolean(d)).map((d) => d.getUTCFullYear());
  return roky.length ? Math.min(...roky) : new Date().getUTCFullYear();
}
