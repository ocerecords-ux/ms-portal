/**
 * VÁNOČNÍ MÓD PORTÁLU (zadání 27. 11. 2026: „pojďme navrhnout vánoční mód
 * portálu" → vybraná varianta: dekorace a zapínání samo od 1. 12. do 1. 1.
 * s možností vypnout).
 *
 * JEN VÝZDOBA, NIC JINÉHO. Namrzlá horní lišta (jinovatka po okrajích,
 * rampouchy u spodní hrany) a vánoční ikona v záložce prohlížeče. Žádné
 * tlačítko, žádný stav projektu ani barva, podle které se v portálu něco
 * pozná, se nemění - portál musí v prosinci fungovat stejně jako v červnu.
 *
 * Čistá část (bez Prismy), ať si ji vezme prohlížeč i server - stejně jako
 * lib/akce.ts nebo lib/tracklist.ts.
 */

/** Začátek a konec sezóny v čase Prahy: od 1. 12. do 1. 1. včetně. */
export function jeVanocniObdobi(ted: Date = new Date()): boolean {
  const casti = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Prague',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(ted);
  const kus = (typ: string) => Number(casti.find((c) => c.type === typ)?.value ?? '0');
  const mesic = kus('month');
  const den = kus('day');
  // Prosinec celý a pak ještě Nový rok - 2. ledna už je po Vánocích.
  return mesic === 12 || (mesic === 1 && den === 1);
}

/**
 * Jak se portál rozsvěcí:
 *   auto  - podle data, tedy od 1. 12. do 1. 1. (výchozí),
 *   vzdy  - svítí pořád; na vyzkoušení v listopadu a pro toho, kdo chce
 *           Vánoce dřív,
 *   nikdy - zhasnuto všem bez ohledu na datum.
 */
export type RezimVanoc = 'auto' | 'vzdy' | 'nikdy';

export function rezimZHodnoty(hodnota: unknown): RezimVanoc {
  return hodnota === 'vzdy' || hodnota === 'nikdy' ? hodnota : 'auto';
}

/**
 * Smí se u tohohle člověka namrzat? VLASTNÍ VOLBA MÁ PŘEDNOST (upřesnění
 * 27. 11. 2026: „ať už si to můžu zapnout i já teď a ostatním až od 1. 12.,
 * ať to můžu testovat").
 *
 * Kdo má u sebe „vzdy", vidí výzdobu hned, i když portál jede podle data;
 * kdo má „nikdy", nevidí ji, ani kdyby portál svítil všem. „auto" znamená
 * řídit se portálem.
 */
export function vanocniVyzdoba(vstup: {
  ted?: Date;
  /** Režim celého portálu. */
  rezim?: RezimVanoc | string | null;
  /** Režim toho jednoho člověka. */
  rezimUzivatele?: RezimVanoc | string | null;
}): boolean {
  const muj = rezimZHodnoty(vstup.rezimUzivatele);
  if (muj === 'vzdy') return true;
  if (muj === 'nikdy') return false;

  const rezim = rezimZHodnoty(vstup.rezim);
  if (rezim === 'nikdy') return false;
  if (rezim === 'vzdy') return true;
  return jeVanocniObdobi(vstup.ted ?? new Date());
}
