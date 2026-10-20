/**
 * NÁZEV PROJEKTU VELKÝMI (zadání 22. 9. 2026: „i když ho někdo zadá malými
 * písmeny, držme prosím formát vždy kapitálkama velkými. Ať je to jednotné
 * v názvech i v kanálech v chatu").
 *
 * Jedno místo pro obojí - projekt i jeho kanál v chatu. Velká písmena podle
 * češtiny, ať se diakritika nezlomí (ž → Ž), a zdvojené mezery se srovnají.
 */
export function nazevProjektuVelky(nazev: string): string {
  return nazev.replace(/\s+/g, ' ').trim().toLocaleUpperCase('cs-CZ');
}

/**
 * NÁZEV SÉRIE TAKY VELKÝMI (zadání 20. 10. 2026: „u názvů sérií držme vše
 * velkými písmeny, jako u názvu projektu. Oprav to i zpětně, když někdo
 * napsal malými").
 *
 * Je to totéž pravidlo i tentýž převod - série se v přehledu ukazuje vedle
 * názvu knihy, takže „Lake Spark" vedle „STOJÍ ZA ČEKÁNÍ" trčí. Vlastní jméno
 * má proto, aby bylo na místě volání vidět, o co jde; kdyby se někdy série
 * psala jinak než projekt, mění se jen tahle funkce.
 */
export function nazevSerieVelky(nazev: string): string {
  return nazevProjektuVelky(nazev);
}

/** Totéž, ale snese i prázdnou hodnotu - vrátí ji, jak přišla. */
export function nazevProjektuVelkyNeboNull<T extends string | null | undefined>(nazev: T): T {
  if (!nazev) return nazev;
  return nazevProjektuVelky(nazev) as T;
}
