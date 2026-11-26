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
 * NÁZEV TRACKU DO PŘEDPISU.
 *
 * MEZERY ZŮSTÁVAJÍ (zadání 19. 11. 2026: „odstraň prosím ‚_' a ‚-' a nahraď
 * je mezerami" → „změň ten vzor takhle"). Do té doby se podle zadání
 * z 15. 10. 2026 psalo `01_KUCHARI-SMRTI`: podtržítko za číslem a pomlčky
 * místo mezer. Dnešní tvar je `01 KUCHARI SMRTI` - mezery v názvech souborů
 * dávno nikde nevadí a tracklist se takhle čte líp.
 *
 * DIAKRITIKA JDE PRYČ POŘÁD. Z názvu tracku se stává název souboru a ten
 * putuje přes cizí systémy, zálohy a FTP, kde háčky a čárky škodí. Název
 * kapitoly je proti tomu text pro člověka a do tagu jde s diakritikou.
 */
export function nazevTracku(text: string): string {
  return bezDiakritiky(text).replace(/\s+/g, ' ').trim();
}

/**
 * TOTÉŽ POD STARŠÍM JMÉNEM (vzor Audiotéky, 30. 10. 2026: „ještě jsem upravil
 * vzor: 02_1938 - KAPITOLA 1.").
 *
 * Dokud jsme mezery měnili na pomlčky, byl tohle výjimečný tvar pro firmu,
 * která si soubory pojmenovává po svém. Od 19. 11. 2026 platí mezery všude,
 * takže se obě funkce chovají stejně; jméno tu zůstává, aby se nemusela
 * přepisovat volání, která o výjimku opírají svůj smysl.
 */
export function nazevTrackuSMezerami(text: string): string {
  return nazevTracku(text);
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
 *
 * ZA ČÍSLEM STOJÍ PODTRŽÍTKO NEBO MEZERA (16. 11. 2026). Náš tvar je
 * `01_NAZEV`, Audiotéka odevzdává `01 NAZEV` - číslo se přepisuje v obou.
 *
 * A TEČKA TAKY (oprava 26. 11. 2026: „když se v tracklistu rozdělí track,
 * musí se změnit i číselná řada, nemůže tam být stejné číslo tracku").
 * Seznamy, které přijdou od klienta nebo z obsahu knihy, bývají psané
 * `01. KAPITOLA 1.` - na tenhle tvar vzorek nesedl, číslo se tedy
 * nepřepisovalo a po rozdělení stopy zůstaly v seznamu dvě „01.".
 */
export function precislujTracky<T extends { nazevTracku: string }>(seznam: T[]): T[] {
  return seznam.map((radek, i) => {
    // Bez vlajky /s - ta vyzaduje novejsi cil prekladu. [\s\S] delá totéž.
    const shoda = /^\s*(\d{1,3})([._\- ][\s\S]*)?$/.exec(radek.nazevTracku);
    if (!shoda) return radek;
    return { ...radek, nazevTracku: `${cisloTracku(i + 1)}${shoda[2] ?? ''}` };
  });
}

/**
 * Tvar názvu stopy, jak se uloží. Druhý parametr byl rozcestník mezi naším
 * tvarem s pomlčkami a tvarem Audiotéky s mezerami; od 19. 11. 2026 mají
 * mezery obě, takže na něm nezáleží. Zůstává, protože ho volající předávají
 * a jednou se může hodit znovu.
 */
export function upravNazevTracku(text: string, _sMezerami?: boolean): string {
  return nazevTracku(text);
}
