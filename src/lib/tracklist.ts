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

/**
 * NÁZEV TRACKU DO PŘEDPISU (zadání 15. 10. 2026: „do mezer mezi slova se musí
 * dát pomlčky. Tzn.: 01_KUCHARI-SMRTI").
 *
 * Z názvu tracku se stává název souboru, takže z něj jde pryč diakritika
 * a mezery nahradí pomlčky. Název kapitoly je proti tomu text pro člověka -
 * ten zůstává, jak je napsaný, a s diakritikou jde do tagu.
 */
export function nazevTracku(text: string): string {
  return bezDiakritiky(text).trim().replace(/\s+/g, '-');
}

/**
 * NÁZEV TRACKU U MODELU, KTERÝ MEZERY NECHÁVÁ (upřesnění 30. 10. 2026 ke vzoru
 * Audiotéky: „ještě jsem upravil vzor: 02_1938 - KAPITOLA 1.").
 *
 * Pomlčka místo mezery je NAŠE pravidlo; klient, který si soubory pojmenovává
 * jinak, je dostane tak, jak je chce - a to je celý rozdíl mezi touhle funkcí
 * a `nazevTracku`. Diakritika jde pryč v obou případech: ta v názvech souborů
 * dělá škodu bez ohledu na model.
 */
export function nazevTrackuSMezerami(text: string): string {
  return bezDiakritiky(text).replace(/\s+/g, ' ').trim();
}

/**
 * POŘADOVÉ ČÍSLO V NÁZVU DRŽÍ KROK S POŘADÍM (upřesnění 15. 10. 2026: „ten
 * název tracku musí jít zkopírovat i s tím pořadovým číslem tracku. Zvukaři
 * to takto kopírují do názvu tracku").
 *
 * Název stopy se kopíruje do DAW i do názvu souboru, takže v něm číslo být
 * musí - a nesmí lhát. Po rozdělení, přidání nebo odebrání stopy se proto
 * číslo na začátku názvu přepíše podle nového pořadí. Název, který číslem
 * nezačíná, zůstane, jak je: do něj portál nemá co mluvit.
 *
 * Je to tu, a ne v obrazovce, protože totéž musí platit i pro seznam, který
 * přepsal Bruno (viz lib/brunoTracklist.ts) - jedno pravidlo, dvě místa.
 */
export function precislujTracky<T extends { nazevTracku: string }>(seznam: T[]): T[] {
  return seznam.map((radek, i) => {
    // Bez vlajky /s - ta vyzaduje novejsi cil prekladu. [\s\S] delá totéž.
    const shoda = /^\s*(\d{1,3})(_[\s\S]*)?$/.exec(radek.nazevTracku);
    if (!shoda) return radek;
    return { ...radek, nazevTracku: `${cisloTracku(i + 1)}${shoda[2] ?? ''}` };
  });
}

/**
 * Který z těch dvou tvarů se u projektu použije. Rozhoduje příznak firmy
 * (Company.tracklistZTextu), ne obrazovka - stejné pravidlo musí platit
 * v prohlížeči i na serveru při ukládání.
 */
export function upravNazevTracku(text: string, sMezerami: boolean): string {
  return sMezerami ? nazevTrackuSMezerami(text) : nazevTracku(text);
}
