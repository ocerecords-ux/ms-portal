import type { KapacitaRoku } from '@/lib/kapacitaServer';

/**
 * ANALÝZY OBSAZENOSTI (zadání 20. 9. 2026: „ať si můžu kdyžtak udělat nějaké
 * analýzy a grafy z obsazenosti studia, třeba někde dole pod tím přehledem").
 *
 * Mapa nahoře odpovídá na „který den je volno". Tyhle tři pohledy odpovídají
 * na otázky, na které se z mřížky dívá špatně:
 *   1. jak se obsazenost vyvíjí v roce (měsíc po měsíci, po studiích),
 *   2. které dny v týdnu jsou slabé,
 *   3. jestli se víc točí dopoledne, nebo odpoledne.
 *
 * Je to čistý počítání nad hotovými daty z `nactiKapacituRoku` - žádná
 * databáze, takže se to dá testovat.
 */

export type BodMesice = {
  mesic: number;
  natoceno: number;
  kapacitaMinut: number;
  procenta: number | null;
  /** Ve stejném pořadí jako studia v přehledu. */
  studia: { id: string; natoceno: number; kapacitaMinut: number; procenta: number | null }[];
};

export type BodDne = {
  /** 0 = neděle … 6 = sobota. */
  denVTydnu: number;
  natoceno: number;
  kapacitaMinut: number;
  procenta: number | null;
  /** Kolik takových dnů v roce bylo. */
  dnu: number;
  /** V kolika z nich se aspoň chvíli točilo. */
  dnuSNatacenim: number;
};

export type BodFrekvence = {
  studioId: string;
  nazev: string;
  barva: string;
  okna: { popis: string; natoceno: number; kapacitaMinut: number; procenta: number | null }[];
};

export type AnalyzaRoku = {
  mesice: BodMesice[];
  dnyVTydnu: BodDne[];
  frekvence: BodFrekvence[];
  /** Dny (napříč studii), kdy bylo studio otevřené - jak byly využité. */
  vyuziti: { plno: number; castecne: number; volno: number };
  nejsilnejsiMesic: { mesic: number; procenta: number } | null;
  nejslabsiMesic: { mesic: number; procenta: number } | null;
};

/** Procenta z minut; bez kapacity (zavřeno) vrací null, ale natáčení = 100 %. */
function pomer(natoceno: number, kapacitaMinut: number): number | null {
  if (kapacitaMinut <= 0) return natoceno > 0 ? 100 : null;
  return Math.round((natoceno / kapacitaMinut) * 100);
}

export function analyzaRoku(prehled: KapacitaRoku): AnalyzaRoku {
  const pocetStudii = prehled.studia.length;

  const mesice: BodMesice[] = prehled.mesice.map((m) => {
    const studia = prehled.studia.map((s) => ({ id: s.id, natoceno: 0, kapacitaMinut: 0, procenta: null as number | null }));
    let natoceno = 0;
    let kapacitaMinut = 0;
    for (const d of m.dny) {
      d.bunky.forEach((b, i) => {
        studia[i].natoceno += b.natoceno;
        studia[i].kapacitaMinut += b.kapacitaMinut;
        natoceno += b.natoceno;
        kapacitaMinut += b.kapacitaMinut;
      });
    }
    for (const s of studia) s.procenta = pomer(s.natoceno, s.kapacitaMinut);
    return { mesic: m.mesic, natoceno, kapacitaMinut, procenta: pomer(natoceno, kapacitaMinut), studia };
  });

  const dnyVTydnu: BodDne[] = Array.from({ length: 7 }, (_, den) => ({
    denVTydnu: den,
    natoceno: 0,
    kapacitaMinut: 0,
    procenta: null,
    dnu: 0,
    dnuSNatacenim: 0,
  }));

  const vyuziti = { plno: 0, castecne: 0, volno: 0 };

  for (const m of prehled.mesice) {
    for (const d of m.dny) {
      const bod = dnyVTydnu[d.denVTydnu];
      // Jeden kalendářní den = tolik „studiodnů", kolik je studií.
      bod.dnu += pocetStudii;
      for (const b of d.bunky) {
        bod.natoceno += b.natoceno;
        bod.kapacitaMinut += b.kapacitaMinut;
        if (b.natoceno > 0) bod.dnuSNatacenim += 1;
        if (b.kapacitaMinut <= 0) continue;
        const p = (b.natoceno / b.kapacitaMinut) * 100;
        if (p >= 95) vyuziti.plno += 1;
        else if (p > 0) vyuziti.castecne += 1;
        else vyuziti.volno += 1;
      }
    }
  }
  for (const bod of dnyVTydnu) bod.procenta = pomer(bod.natoceno, bod.kapacitaMinut);

  const frekvence: BodFrekvence[] = prehled.studia.map((s) => ({
    studioId: s.id,
    nazev: s.nazev,
    barva: s.barva,
    okna: s.frekvence.map((f) => ({ popis: f.popis, natoceno: 0, kapacitaMinut: 0, procenta: null as number | null })),
  }));
  for (const m of prehled.mesice) {
    for (const d of m.dny) {
      d.bunky.forEach((b, i) => {
        b.casti.forEach((c, k) => {
          const okno = frekvence[i]?.okna[k];
          if (!okno) return;
          okno.natoceno += c.natoceno;
          okno.kapacitaMinut += c.kapacitaMinut;
        });
      });
    }
  }
  for (const f of frekvence) for (const o of f.okna) o.procenta = pomer(o.natoceno, o.kapacitaMinut);

  // Nejsilnější a nejslabší měsíc - jen z těch, kde se vůbec točilo, ať
  // prázdný prosinec nevyhraje jako „nejslabší" ještě před sezonou.
  const sDaty = mesice.filter((m) => m.kapacitaMinut > 0 && m.natoceno > 0);
  const nej = (vetsi: boolean) =>
    sDaty.length === 0
      ? null
      : sDaty.reduce((a, b) => ((b.procenta ?? 0) > (a.procenta ?? 0) === vetsi ? b : a));
  const silny = nej(true);
  const slaby = nej(false);

  return {
    mesice,
    dnyVTydnu,
    frekvence,
    vyuziti,
    nejsilnejsiMesic: silny ? { mesic: silny.mesic, procenta: silny.procenta ?? 0 } : null,
    nejslabsiMesic: slaby ? { mesic: slaby.mesic, procenta: slaby.procenta ?? 0 } : null,
  };
}

/** Řádky pro CSV - jeden řádek = den × studio × frekvence. */
export function csvKapacity(prehled: KapacitaRoku): string {
  const hlavicka = [
    'datum',
    'den v tydnu',
    'vikend',
    'studio',
    'frekvence',
    'nataceno (h)',
    'kapacita (h)',
    'obsazenost (%)',
    'pocet nataceni',
  ];
  const DNY = ['neděle', 'pondělí', 'úterý', 'středa', 'čtvrtek', 'pátek', 'sobota'];
  const cislo = (v: number) => v.toFixed(2).replace('.', ',');
  const radky: string[] = [hlavicka.join(';')];

  for (const m of prehled.mesice) {
    for (const d of m.dny) {
      const datum = `${prehled.rok}-${String(m.mesic).padStart(2, '0')}-${String(d.den).padStart(2, '0')}`;
      d.bunky.forEach((b, i) => {
        const studio = prehled.studia[i];
        b.casti.forEach((c, k) => {
          const okno = studio.frekvence[k];
          const p = pomer(c.natoceno, c.kapacitaMinut);
          radky.push(
            [
              datum,
              DNY[d.denVTydnu],
              d.vikend ? 'ano' : 'ne',
              studio.nazev,
              okno?.popis ?? '',
              cislo(c.natoceno / 60),
              cislo(c.kapacitaMinut / 60),
              p === null ? '' : String(p),
              String(c.pocet),
            ].join(';'),
          );
        });
      });
    }
  }
  return radky.join('\n');
}
