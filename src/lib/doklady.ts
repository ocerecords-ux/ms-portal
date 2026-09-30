import { kodJazyka, prelozit, type Jazyk } from '@/lib/jazyk';
import type { Currency } from '@prisma/client';

/**
 * Společné počty a formáty pro Doklady (zadani 6. 9. 2026).
 *
 * Částky se všude drží v NEJMENŠÍ JEDNOTCE měny jako celé číslo (haléře,
 * centy, pence). S desetinnými čísly by se při sčítání položek postupně
 * rozjížděly koruny a doklad by nakonec neseděl.
 */

/**
 * Měny, které jdou na dokladu vybrat. Dolar přibyl 17. 9. 2026 kvůli výdajům
 * placeným v USD; kurz si portál bere z ČNB stejně jako u eura a libry.
 */
export const CURRENCIES = ['CZK', 'EUR', 'USD', 'GBP'] as const;

export const CURRENCY_LABELS: Record<Currency, string> = {
  CZK: 'Kč',
  EUR: '€',
  USD: '$',
  GBP: '£',
};

export const CURRENCY_NAMES: Record<Currency, string> = {
  CZK: 'Koruna česká (CZK)',
  EUR: 'Euro (EUR)',
  USD: 'Americký dolar (USD)',
  GBP: 'Britská libra (GBP)',
};

/**
 * Název měny do nabídky měn (dávka 4, 27. 9. 2026). Jazyk je nepovinný, ať
 * volající, kteří ho neřeší (PDF dokladu), dál dostanou češtinu beze změny.
 */
export function nazevMeny(currency: Currency, jazyk: Jazyk = 'cs'): string {
  return jazyk === 'cs' ? CURRENCY_NAMES[currency] : prelozit(jazyk, `mena.${currency}`);
}

/** Vykreslení částky v nejmenší jednotce, např. 123450 CZK → "1 234,50 Kč". */
export function formatMoney(minor: number, currency: Currency, jazyk: Jazyk = 'cs'): string {
  const value = minor / 100;
  return `${new Intl.NumberFormat(kodJazyka(jazyk), { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)} ${CURRENCY_LABELS[currency]}`;
}

/** "1234,50" nebo "1234.50" → 123450. Nesmyslný vstup dá 0. */
export function parseMoneyToMinor(input: string): number {
  const clean = String(input).replace(/\s/g, '').replace(',', '.');
  const value = Number.parseFloat(clean);
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100);
}

/** 123450 → "1234.50" pro předvyplnění do formuláře. */
export function minorToInput(minor: number): string {
  return (minor / 100).toFixed(2);
}

export type LineItem = {
  quantity: number;
  unitPriceMinor: number;
  vatRate: number;
};

export type Totals = {
  exVat: number;
  vat: number;
  incVat: number;
  /** Rozpis podle sazby DPH - na dokladu se uvádí zvlášť. */
  byRate: { rate: number; base: number; vat: number }[];
  /** Základ PŘED slevou. Beze slevy je stejný jako `exVat`. */
  exVatPredSlevou: number;
  /** Odečtená sleva bez DPH; 0 = žádná nebyla. */
  sleva: number;
  slevaPopis: string | null;
};

/**
 * Sleva na celém dokladu (zadání 14. 9. 2026: „potřebuju u nabídek a faktur
 * mít možnost přidat nějakou slevu").
 *
 * Buď procenta, nebo pevná částka. Obojí naráz nedává smysl, takže platí
 * procenta, když jsou vyplněná.
 */
export type Sleva = {
  slevaProcent?: number | null;
  slevaMinor?: number | null;
  slevaPopis?: string | null;
};

/**
 * POLOŽKY, KTERÉ SE MAJÍ ULOŽIT (oprava 30. 9. 2026: „když Karolína dělá novou
 * cenovou nabídku, tak tam dá cenu a uloží ji, ale pak tam má nulu").
 *
 * Editor si pod poslední položkou drží prázdný řádek, aby bylo kam psát, a ten
 * se posílat nemá. Do teď se to řešilo tak, že se zahodil KAŽDÝ řádek bez
 * popisu - jenže kdo vyplnil cenu a popis nechal na potom, přišel o celý
 * řádek. Doklad se uložil bez položek, ukázal nulu a portál na to neřekl ani
 * slovo. Přesně tak vznikla nabídka N2026026 na 0,00 Kč.
 *
 * Teď se rozlišuje:
 *  - PRÁZDNÝ řádek (nic v popisu a nulová cena) = pomocný, tiše se zahodí,
 *  - řádek s cenou, ale bez popisu = někdo do něj psal; uložení se zastaví
 *    a řekne se které.
 *
 * Množství ani jednotka do rozhodování nevstupují: nový řádek je má
 * předvyplněné (1 ks), takže by se prázdný řádek tvářil jako vyplněný.
 */
export type PolozkaKUlozeni = { description: string; unitPriceMinor: number };

export function jePrazdnaPolozka(item: PolozkaKUlozeni): boolean {
  return !item.description.trim() && !item.unitPriceMinor;
}

/**
 * Vrátí položky k odeslání a číslo prvního řádku (od 1), kterému chybí popis.
 * Když `chybiPopis` není null, nemá se ukládat vůbec nic.
 */
export function pripravPolozky<T extends PolozkaKUlozeni>(
  items: T[],
): { polozky: T[]; chybiPopis: number | null } {
  const polozky = items.filter((i) => !jePrazdnaPolozka(i));
  const index = polozky.findIndex((i) => !i.description.trim());
  return { polozky, chybiPopis: index < 0 ? null : index + 1 };
}

/**
 * Součet položek. Zaokrouhluje se až DPH u každé sazby, ne u každé položky.
 *
 * SLEVA SE ROZPOČÍTÁ MEZI SAZBY podle jejich podílu na základu, ne až
 * z výsledku. U dokladu, kde je něco s 21 % a něco bez daně, by sleva
 * odečtená až na konci znamenala, že se odvede daň z částky, kterou zákazník
 * nezaplatil. Zbytek po zaokrouhlení padne na první (nejnižší) sazbu, aby
 * součet vyšel do haléře.
 */
export function computeTotals(items: LineItem[], sleva?: Sleva | null): Totals {
  const bases = new Map<number, number>();
  for (const item of items) {
    const base = Math.round(item.quantity * item.unitPriceMinor);
    bases.set(item.vatRate, (bases.get(item.vatRate) ?? 0) + base);
  }

  const zaklady = Array.from(bases.entries()).sort((a, b) => a[0] - b[0]);
  const exVatPredSlevou = zaklady.reduce((sum, [, base]) => sum + base, 0);

  const procent = Number(sleva?.slevaProcent ?? 0);
  const pevna = Number(sleva?.slevaMinor ?? 0);
  let odecet =
    procent > 0 ? Math.round((exVatPredSlevou * procent) / 100) : pevna > 0 ? Math.round(pevna) : 0;
  // Sleva nikdy nesmí přetáhnout doklad do záporu.
  odecet = Math.max(0, Math.min(odecet, Math.max(0, exVatPredSlevou)));

  let rozdano = 0;
  const byRate = zaklady.map(([rate, base], i) => {
    const podil =
      exVatPredSlevou > 0
        ? i === zaklady.length - 1
          ? odecet - rozdano
          : Math.round((odecet * base) / exVatPredSlevou)
        : 0;
    rozdano += podil;
    const snizeny = base - podil;
    return { rate, base: snizeny, vat: Math.round((snizeny * rate) / 100) };
  });

  const exVat = byRate.reduce((sum, r) => sum + r.base, 0);
  const vat = byRate.reduce((sum, r) => sum + r.vat, 0);
  return {
    exVat,
    vat,
    incVat: exVat + vat,
    byRate,
    exVatPredSlevou,
    sleva: odecet,
    slevaPopis: sleva?.slevaPopis?.trim() || null,
  };
}

/**
 * Číselná řada. Ve formátu se nahrazují zástupné znaky:
 *   {YYYY} rok, {YY} rok dvojčíslím, {MM} měsíc,
 *   {NNN} (i {NNNN}, {NNNNN}…) pořadové číslo doplněné nulami.
 * Např. "{YYYY}{NNN}" + 7 → "2026007", "F{YY}-{NNNN}" + 7 → "F26-0007".
 */
export function expandNumberFormat(format: string, sequence: number, date: Date = new Date()): string {
  const year = date.getFullYear();
  return format
    .replace(/\{YYYY\}/g, String(year))
    .replace(/\{YY\}/g, String(year).slice(-2))
    .replace(/\{MM\}/g, String(date.getMonth() + 1).padStart(2, '0'))
    .replace(/\{(N+)\}/g, (_m, digits: string) => String(sequence).padStart(digits.length, '0'));
}

/** Náhled řady pro nastavení - ať admin hned vidí, co mu vyleze. */
export function previewNumbers(format: string, from: number, count = 3): string[] {
  return Array.from({ length: count }, (_, i) => expandNumberFormat(format, from + i));
}

export const OFFER_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Rozpracovaná',
  SENT: 'Odeslaná',
  APPROVED: 'Schválená',
  REJECTED: 'Odmítnutá',
};

/**
 * Stav nabídky pro obrazovku (dávka 4, 27. 9. 2026). Klíče jsou tytéž, které
 * používá seznam nabídek i editor - ať stav nemá dvě různá znění.
 *
 * OFFER_STATUS_LABELS zůstává: bere si ho PDF a e-maily, kde se jazyk neřídí
 * přepínačem v liště, ale dokladem.
 */
const KLICE_STAVU_NABIDKY: Record<string, string> = {
  DRAFT: 'nabidka.stav.rozpracovana',
  SENT: 'nabidka.stav.odeslana',
  APPROVED: 'nabidka.stav.schvalena',
  REJECTED: 'nabidka.stav.odmitnuta',
};

export function nazevStavuNabidky(status: string, jazyk: Jazyk = 'cs'): string {
  const klic = KLICE_STAVU_NABIDKY[status];
  return klic ? prelozit(jazyk, klic) : (OFFER_STATUS_LABELS[status] ?? status);
}

export const OFFER_STATUS_CLASSES: Record<string, string> = {
  DRAFT: 'bg-field text-muted',
  SENT: 'bg-tint text-brand-purpleDark',
  APPROVED: 'bg-okTint text-status-done',
  REJECTED: 'bg-dangerTint text-danger',
};

/** Adresa firmy na jeden řádek - pro hlavičku dokladu. */
export function formatAddress(parts: {
  addressStreet?: string | null;
  addressZip?: string | null;
  addressCity?: string | null;
}): string {
  const line = [parts.addressStreet, [parts.addressZip, parts.addressCity].filter(Boolean).join(' ')]
    .filter(Boolean)
    .join(', ');
  return line;
}

/**
 * Číslo účtu v úplném tvaru, i s kódem banky: „3169021011/3030"
 * (zadání 13. 9. 2026: „dal bych ho celý i za lomítkem /3030 s kódem banky").
 *
 * Kód banky se u účtu vede zvlášť (pole Banka), takže na dokladu by jinak
 * zůstalo jen číslo - a podle něj se platba zadat nedá. Když už je kód
 * v čísle napsaný, nebo to není čtyřčíslí (někdo si do Banky napsal jméno),
 * nechá se číslo tak, jak je.
 */
export function cisloUctuSKodem(cislo?: string | null, banka?: string | null): string | null {
  const ucet = cislo?.trim();
  if (!ucet) return null;
  if (ucet.includes('/')) return ucet;
  const kod = banka?.trim();
  return kod && /^\d{4}$/.test(kod) ? `${ucet}/${kod}` : ucet;
}
