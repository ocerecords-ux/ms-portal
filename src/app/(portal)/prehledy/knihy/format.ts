/**
 * Formátování pro přehled Knihy a rozpočty.
 *
 * POZOR NA JEDNOTKY. Sousední záložka Obrat a zisk počítá v haléřích a její
 * `kc()` dělí stem. Tady se počítá v CELÝCH KORUNÁCH (tak se drží výkazy
 * i rozpočty), takže má přehled vlastní formátování - sdílet jedno by znamenalo
 * dřív nebo později stonásobnou chybu v tabulce.
 */

/** Celé koruny: 17040 -> „17 040 Kč". */
export function kc(koruny: number): string {
  return `${Math.round(koruny).toLocaleString('cs-CZ')} Kč`;
}

/** Krátce na osu grafu: „1,2 mil.", „350 tis.", „800". */
export function kcKratce(koruny: number): string {
  const a = Math.abs(koruny);
  if (a >= 1_000_000) return `${(koruny / 1_000_000).toLocaleString('cs-CZ', { maximumFractionDigits: 1 })} mil.`;
  if (a >= 1_000) return `${Math.round(koruny / 1_000).toLocaleString('cs-CZ')} tis.`;
  return Math.round(koruny).toLocaleString('cs-CZ');
}

/** Hodiny na jedno desetinné místo: „12,5 h". */
export function hodiny(h: number): string {
  return `${h.toLocaleString('cs-CZ', { maximumFractionDigits: 1 })} h`;
}

/** „1 kniha / 2 knihy / 5 knih" - česky se to bez toho nedá napsat. */
export function pocetKnih(n: number): string {
  if (n === 1) return '1 kniha';
  if (n >= 2 && n <= 4) return `${n} knihy`;
  return `${n} knih`;
}

export function datum(d: Date): string {
  return new Intl.DateTimeFormat('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' }).format(d);
}

/** Barvy druhů práce - jedna definice pro graf, legendu i tabulku. */
export const BARVY = {
  nataceni: 'var(--viz-nataceni)',
  strih: 'var(--viz-strih)',
  opravy: 'var(--viz-opravy)',
  ostatni: 'var(--viz-ostatni)',
} as const;
