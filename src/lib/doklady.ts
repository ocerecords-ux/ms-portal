import type { Currency } from '@prisma/client';

/**
 * Společné počty a formáty pro Doklady (zadani 6. 9. 2026).
 *
 * Částky se všude drží v NEJMENŠÍ JEDNOTCE měny jako celé číslo (haléře,
 * centy, pence). S desetinnými čísly by se při sčítání položek postupně
 * rozjížděly koruny a doklad by nakonec neseděl.
 */

export const CURRENCIES = ['CZK', 'EUR', 'GBP'] as const;

export const CURRENCY_LABELS: Record<Currency, string> = {
  CZK: 'Kč',
  EUR: '€',
  GBP: '£',
};

export const CURRENCY_NAMES: Record<Currency, string> = {
  CZK: 'Koruna česká (CZK)',
  EUR: 'Euro (EUR)',
  GBP: 'Britská libra (GBP)',
};

/** Vykreslení částky v nejmenší jednotce, např. 123450 CZK → "1 234,50 Kč". */
export function formatMoney(minor: number, currency: Currency): string {
  const value = minor / 100;
  return `${new Intl.NumberFormat('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)} ${CURRENCY_LABELS[currency]}`;
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
};

/** Součet položek. Zaokrouhluje se až DPH u každé sazby, ne u každé položky. */
export function computeTotals(items: LineItem[]): Totals {
  const bases = new Map<number, number>();
  for (const item of items) {
    const base = Math.round(item.quantity * item.unitPriceMinor);
    bases.set(item.vatRate, (bases.get(item.vatRate) ?? 0) + base);
  }

  const byRate = Array.from(bases.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([rate, base]) => ({ rate, base, vat: Math.round((base * rate) / 100) }));

  const exVat = byRate.reduce((sum, r) => sum + r.base, 0);
  const vat = byRate.reduce((sum, r) => sum + r.vat, 0);
  return { exVat, vat, incVat: exVat + vat, byRate };
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
