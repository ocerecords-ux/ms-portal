/**
 * VLASTNÍ POŘADÍ ZÁLOŽEK (zadání 29. 9. 2026: „na ty záložky karet bych dal
 * taky možnost si změnit individuálně pořadí, ať si každý uživatel udělá, jak
 * chce. Udělal bych to na všech takových propadech v portálu").
 *
 * Soubor je bez Prismy - řadí se jím lišta v prohlížeči i na serveru, aby se
 * záložky při načtení stránky nepřeskládaly před očima.
 */

/** Jedna záložka v liště. `klic` je to, co se ukládá do pořadí. */
export type Zalozka = {
  /** Stálý klíč záložky. Bere se z adresy, takže nepotřebuje zvláštní údaj. */
  klic: string;
  href: string;
  nazev: string;
};

/**
 * Seřadí záložky podle uloženého pořadí.
 *
 * Co v pořadí není (záložka přibyla po uložení), jde nakonec v původním
 * pořadí; klíč, který už neexistuje, se ignoruje. Lišta se tím nerozbije, ani
 * když se seznam v kódu změní.
 */
export function seradZalozky<T extends { klic: string }>(zalozky: T[], poradi: string[]): T[] {
  if (poradi.length === 0) return zalozky;
  const misto = new Map(poradi.map((klic, i) => [klic, i]));
  const konec = poradi.length;
  return [...zalozky].sort((a, b) => (misto.get(a.klic) ?? konec) - (misto.get(b.klic) ?? konec));
}

/** Prohodí dvě sousední položky. Mimo rozsah vrátí seznam beze změny. */
export function posun<T>(seznam: T[], odkud: number, kam: number): T[] {
  if (odkud < 0 || kam < 0 || odkud >= seznam.length || kam >= seznam.length) return seznam;
  const kopie = [...seznam];
  [kopie[odkud], kopie[kam]] = [kopie[kam], kopie[odkud]];
  return kopie;
}
