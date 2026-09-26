import { kodJazyka, type Jazyk } from '@/lib/jazyk';
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
