/**
 * PŘIHLAŠOVACÍ JMÉNO ÚČTU (zadání 29. 9. 2026: „co je to za blbost? Všude
 * jinde se dá přihlásit bez @").
 *
 * Portál přihlašuje podle sloupce `User.email` a ten dlouho musel být
 * opravdová adresa. U účtů, které nikomu nepatří, to dává jen práci: tabule
 * ve studiu se přihlašuje jako „brno2" a žádnou schránku nemá a mít nebude.
 *
 * Proto se bere obojí:
 *  - e-mailová adresa, jako dosud - na tu chodí pozvánka i obnova hesla,
 *  - prosté jméno bez zavináče („brno2") - přihlásí se stejně, jen mu portál
 *    nemá kam poslat mail. Volající to musí ohlídat, viz `jeEmail`.
 *
 * Píše se vždycky malými písmeny, protože přihlášení porovnává přesnou shodu
 * (viz lib/auth.ts) a „Brno2" a „brno2" musí být tentýž účet.
 */

/** Adresa, na kterou jde poslat e-mail. */
export function jeEmail(hodnota: string): boolean {
  const v = hodnota.trim();
  // Záměrně jednoduché: jeden zavináč, tečka za ním, žádné mezery. Přísnější
  // kontrola stejně nezaručí, že schránka existuje - to ukáže až odeslání.
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
}

/** Jméno bez zavináče - „brno2", „tabule-praha". */
export function jeJmenoBezZavinace(hodnota: string): boolean {
  return /^[a-z0-9][a-z0-9._-]{1,59}$/.test(hodnota.trim().toLowerCase());
}

/** Co portál přijme jako přihlašovací jméno. */
export function jePrihlasovaciJmeno(hodnota: string): boolean {
  const v = hodnota.trim();
  return v.includes('@') ? jeEmail(v) : jeJmenoBezZavinace(v);
}

/** Hláška, když se to nepovede. Jedna na obou stranách portálu. */
export const CHYBA_PRIHLASOVACI_JMENO =
  'Zadejte e-mail, nebo jméno bez zavináče (písmena, číslice, tečka, pomlčka nebo podtržítko).';

/** Na co se přihlašovací jméno srovná před uložením i před přihlášením. */
export function normalizujPrihlasovaciJmeno(hodnota: string): string {
  return hodnota.trim().toLowerCase();
}
