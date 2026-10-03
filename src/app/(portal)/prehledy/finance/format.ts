import { kodJazyka, prelozit, type Jazyk } from '@/lib/jazyk';

/**
 * Formátování pro přehled Obrat a zisk.
 *
 * JAZYK JE NEPOVINNÝ (vzor nazevMeny z dávky 4): bez něj se formátuje česky,
 * takže voláním odjinud (pošta, PDF) se nic nemění.
 */

/** Celé koruny z haléřů: 1234567 -> „12 346 Kč" / „12,346 Kč". */
export function kc(minor: number, jazyk: Jazyk = 'cs'): string {
  return `${Math.round(minor / 100).toLocaleString(kodJazyka(jazyk))} Kč`;
}

/** Krátce na osu: „1,2 mil.", „350 tis.", „800". */
export function kcKratce(minor: number, jazyk: Jazyk = 'cs'): string {
  const k = minor / 100;
  const a = Math.abs(k);
  const kod = kodJazyka(jazyk);
  if (a >= 1_000_000)
    return `${(k / 1_000_000).toLocaleString(kod, { maximumFractionDigits: 1 })} ${prelozit(jazyk, 'format.milionu')}`;
  if (a >= 1_000) return `${Math.round(k / 1_000).toLocaleString(kod)} ${prelozit(jazyk, 'format.tisic')}`;
  return Math.round(k).toLocaleString(kod);
}
