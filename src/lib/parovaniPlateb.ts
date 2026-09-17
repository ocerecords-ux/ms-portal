/**
 * KTERÁ FAKTURA PATŘÍ K PŘÍCHOZÍ PLATBĚ (zadání 17. 9. 2026: „potřebuju, ať se
 * ta banka páruje sama").
 *
 * Banka o platbě řekne datum, částku, protistranu a kus textu. Variabilní
 * symbol v tom textu bývá, ale pokaždé jinak zapsaný („VS: 2026041",
 * „/VS/2026041", nebo prostě jen číslo), a někdy tam není vůbec.
 *
 * Pravidlo je proto stejné jako u herců v rozpočtu: JISTOTA PŘED POHODLÍM.
 *   - sedí VS i částka  → faktura se označí jako uhrazená sama,
 *   - sedí jen jedno z toho → portál to nabídne jako návrh a čeká na člověka,
 *   - nesedí nic → platba zůstane v seznamu nespárovaných.
 *
 * Špatně označená faktura je horší než neoznačená: přestane se upomínat
 * a nikdo si toho nevšimne.
 */

export type PlatbaKParovani = {
  /** Kladná částka příchozí platby v nejmenší jednotce měny. */
  amountMinor: number;
  currency: string;
  variableSymbol?: string | null;
  /** Zpráva pro příjemce, poznámka - cokoliv textového od banky. */
  reference?: string | null;
  counterpartyName?: string | null;
};

export type FakturaKParovani = {
  id: string;
  number: string;
  variableSymbol: string;
  currency: string;
  /** Celkem s DPH v nejmenší jednotce měny. */
  totalIncVatMinor: number;
};

export type Nalez =
  | { druh: 'presna'; invoiceId: string; duvod: string }
  | { druh: 'navrh'; invoiceId: string; duvod: string }
  | { druh: 'nic'; duvod: string };

/** Jen číslice - „VS: 2026 041" i „2026041" dají totéž. */
function ciselne(text: string | null | undefined): string {
  return String(text ?? '').replace(/\D/g, '');
}

/**
 * Variabilní symbol z textu platby. Nejdřív se hledá tam, kde je popsaný
 * („VS 2026041", „v.s. 2026041", „/VS/2026041"), a teprve když takový zápis
 * není, vezme se osamocené číslo. Delší než deset číslic VS být nemůže.
 */
export function vyctiVariabilniSymbol(text: string | null | undefined): string | null {
  const zdroj = String(text ?? '');
  if (!zdroj.trim()) return null;

  const popsany = zdroj.match(/\bv\.?\s?s\.?\s*[:\-/]?\s*(\d{1,10})\b/i);
  if (popsany) return popsany[1];

  const lomitkove = zdroj.match(/\/VS\/(\d{1,10})/i);
  if (lomitkove) return lomitkove[1];

  // Osamocené číslo bereme jen tehdy, když je v textu jediné - dvě čísla
  // znamenají, že se neví, které z nich je VS.
  const cisla = zdroj.match(/\b\d{4,10}\b/g);
  if (cisla && cisla.length === 1) return cisla[0];

  return null;
}

/**
 * Přiřazení platby k faktuře.
 *
 * @param platba pohyb na účtu (jen příchozí - odchozí sem nemá chodit)
 * @param faktury neuhrazené faktury, mezi kterými se hledá
 */
export function najdiFakturuKPlatbe(platba: PlatbaKParovani, faktury: FakturaKParovani[]): Nalez {
  if (platba.amountMinor <= 0) return { druh: 'nic', duvod: 'Odchozí platba.' };
  if (faktury.length === 0) return { druh: 'nic', duvod: 'Žádná neuhrazená faktura.' };

  const vs = ciselne(platba.variableSymbol) || ciselne(vyctiVariabilniSymbol(platba.reference));
  const vMene = faktury.filter((f) => f.currency === platba.currency);

  if (vs) {
    const podleVs = vMene.filter((f) => ciselne(f.variableSymbol) === vs);
    if (podleVs.length === 1) {
      const faktura = podleVs[0];
      if (faktura.totalIncVatMinor === platba.amountMinor) {
        return { druh: 'presna', invoiceId: faktura.id, duvod: `Sedí variabilní symbol ${vs} i částka.` };
      }
      return {
        druh: 'navrh',
        invoiceId: faktura.id,
        duvod:
          platba.amountMinor < faktura.totalIncVatMinor
            ? `Sedí variabilní symbol ${vs}, ale přišlo míň, než je na faktuře.`
            : `Sedí variabilní symbol ${vs}, ale přišlo víc, než je na faktuře.`,
      };
    }
    if (podleVs.length > 1) {
      return { druh: 'nic', duvod: `Variabilní symbol ${vs} má víc faktur - rozhodne člověk.` };
    }
  }

  // Bez variabilního symbolu se párovat samo nebude, ale když částka sedí
  // jediné faktuře, stojí za to ji nabídnout.
  const podleCastky = vMene.filter((f) => f.totalIncVatMinor === platba.amountMinor);
  if (podleCastky.length === 1) {
    return {
      druh: 'navrh',
      invoiceId: podleCastky[0].id,
      duvod: vs
        ? `Variabilní symbol ${vs} nesedí žádné faktuře, ale částka sedí přesně téhle.`
        : 'Platba nemá variabilní symbol, částka ale sedí přesně téhle faktuře.',
    };
  }

  return {
    druh: 'nic',
    duvod: vs ? `Variabilní symbol ${vs} nesedí žádné neuhrazené faktuře.` : 'Bez variabilního symbolu a částka nesedí.',
  };
}
