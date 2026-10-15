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

/**
 * NÁZEV TRACKU BEZ DIAKRITIKY (zadání 15. 10. 2026: „názvy tracků musí být
 * bez diakritiky. V názvu tagu už být může").
 *
 * Z názvu tracku se stává název souboru a ten putuje přes cizí systémy,
 * zálohy a FTP, kde háčky a čárky dělají nejvíc škody. Název kapitoly je
 * proti tomu text pro člověka a do tagu jde s diakritikou, jak má být.
 */
export function bezDiakritiky(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // Pár písmen, která se rozkladem nerozloží.
    .replace(/[Đ]/g, 'D')
    .replace(/[đ]/g, 'd')
    .replace(/[Ł]/g, 'L')
    .replace(/[ł]/g, 'l');
}
