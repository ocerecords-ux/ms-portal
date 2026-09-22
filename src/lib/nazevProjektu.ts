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

/** Totéž, ale snese i prázdnou hodnotu - vrátí ji, jak přišla. */
export function nazevProjektuVelkyNeboNull<T extends string | null | undefined>(nazev: T): T {
  if (!nazev) return nazev;
  return nazevProjektuVelky(nazev) as T;
}
