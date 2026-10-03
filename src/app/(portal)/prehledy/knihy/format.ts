/**
 * Formátování pro přehled Knihy a rozpočty.
 *
 * POZOR NA JEDNOTKY. Sousední záložka Obrat a zisk počítá v haléřích a její
 * `kc()` dělí stem. Tady se počítá v CELÝCH KORUNÁCH (tak se drží výkazy
 * i rozpočty), takže má přehled vlastní formátování - sdílet jedno by znamenalo
 * dřív nebo později stonásobnou chybu v tabulce.
 */

import { kodJazyka, prelozit, prelozitS, type Jazyk } from '@/lib/jazyk';

/** Celé koruny: 17040 -> „17 040 Kč" / „17,040 Kč". */
export function kc(koruny: number, jazyk: Jazyk = 'cs'): string {
  return `${Math.round(koruny).toLocaleString(kodJazyka(jazyk))} Kč`;
}

/** Krátce na osu grafu: „1,2 mil.", „350 tis.", „800". */
export function kcKratce(koruny: number, jazyk: Jazyk = 'cs'): string {
  const a = Math.abs(koruny);
  const kod = kodJazyka(jazyk);
  if (a >= 1_000_000)
    return `${(koruny / 1_000_000).toLocaleString(kod, { maximumFractionDigits: 1 })} ${prelozit(jazyk, 'format.milionu')}`;
  if (a >= 1_000) return `${Math.round(koruny / 1_000).toLocaleString(kod)} ${prelozit(jazyk, 'format.tisic')}`;
  return Math.round(koruny).toLocaleString(kod);
}

/** Hodiny na jedno desetinné místo: „12,5 h". */
export function hodiny(h: number, jazyk: Jazyk = 'cs'): string {
  return `${h.toLocaleString(kodJazyka(jazyk), { maximumFractionDigits: 1 })} h`;
}

/**
 * „1 kniha / 2 knihy / 5 knih" - česky se to bez toho nedá napsat.
 * Anglicky stačí dva tvary, takže je každý tvar vlastní klíč (pravidlo 7).
 */
export function pocetKnih(n: number, jazyk: Jazyk = 'cs'): string {
  const klic = n === 1 ? 'jedna' : n >= 2 && n <= 4 ? 'nekolik' : 'mnoho';
  return prelozitS(jazyk, `knihy.pocetKnih.${klic}`, { pocet: n });
}

export function datum(d: Date, jazyk: Jazyk = 'cs'): string {
  return new Intl.DateTimeFormat(kodJazyka(jazyk), { day: 'numeric', month: 'numeric', year: 'numeric' }).format(d);
}

/** Barvy druhů práce - jedna definice pro graf, legendu i tabulku. */
export const BARVY = {
  nataceni: 'var(--viz-nataceni)',
  strih: 'var(--viz-strih)',
  opravy: 'var(--viz-opravy)',
  ostatni: 'var(--viz-ostatni)',
} as const;
