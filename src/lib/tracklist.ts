/**
 * TRACKLIST AUDIOKNIHY - čistá část (zadání 15. 10. 2026).
 *
 * Soubor je BEZ PRISMY a bez Disku, aby ho mohla vzít i obrazovka v
 * prohlížeči - stejně jako lib/fakturaCast.ts. Všechno, co sahá do databáze
 * nebo na Google Disk, je v lib/tracklistServer.ts.
 */

export type Track = { poradi: number; nazevTracku: string; nazevKapitoly: string };

/** „1" → „01" (zadání 15. 10. 2026: „01, 02, 03"). */
export function cisloTracku(poradi: number): string {
  return String(poradi).padStart(2, '0');
}

/** Název kapitoly bez koncovky „, Část 2" - viz rozdělení tracku. */
export function zakladKapitoly(kapitola: string): string {
  return kapitola.replace(/,\s*(Část|Cast|Part)\s*\d+\s*$/i, '').trim();
}
