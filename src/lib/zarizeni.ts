/**
 * Počítač, nebo mobil? (zadání 19. 9. 2026: „chci, aby byla možnost si jinak
 * poskládat hlavní nabídku nahoře na liště v mobilní aplikaci a jinak na
 * počítači. A taky to, jaké se mi zobrazují sloupce v přehledu projektu.")
 *
 * Rozhoduje šířka obrazovky, ne druh přístroje: telefon na šířku nebo úzké
 * okno se chová jako mobil, protože se do něj vejde stejně málo. Hranice je
 * stejná jako u lišty jako u tabulky projektů (pod 768 px, Tailwind `md`) - tam se
 * tabulka už zužuje na telefonní podobu. Tablet na výšku je tedy „mobil".
 */
export type Zarizeni = 'POCITAC' | 'MOBIL';

export const ZARIZENI: Zarizeni[] = ['POCITAC', 'MOBIL'];

export const MOBIL_DOTAZ = '(max-width: 767px)';

export function jeZarizeni(hodnota: unknown): hodnota is Zarizeni {
  return hodnota === 'POCITAC' || hodnota === 'MOBIL';
}

export const NAZEV_ZARIZENI: Record<Zarizeni, string> = {
  POCITAC: 'počítač',
  MOBIL: 'mobil',
};
