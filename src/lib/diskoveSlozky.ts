/**
 * SLOŽKY NA DISKU, KTERÉ PORTÁL NABÍZÍ (zadání 30. 9. 2026: „máme na disku
 * složky: Klientská zóna, Dokumenty, Marketing. Potřebuju, ať někteří
 * uživatelé nevidí některé složky. Teď vidí všechno").
 *
 * Tenhle soubor je BEZ PRISMY, aby ho vzal i prohlížeč: rozhodování, komu se
 * složka nabídne, je čistá funkce a dá se otestovat bez databáze. Načítání
 * dělá lib/diskoveSlozkyServer.ts.
 */

export type SlozkaKNabidce = {
  id: string;
  nazev: string;
  popis: string | null;
  /** ID složky na Disku vytažené z odkazu. Bez něj se složka nedá otevřít. */
  rootId: string | null;
  aktivni: boolean;
  /** Má ji ten člověk zaškrtnutou na kartě účtu? */
  prideleno: boolean;
};

export type NabidnutaSlozka = {
  id: string;
  nazev: string;
  popis: string | null;
  rootId: string;
};

/**
 * Které složky se člověku ukážou.
 *
 * Tři podmínky, všechny musí platit:
 *  - složka je zapnutá (vypnutá se nenabízí nikomu, ani superadminovi -
 *    vypnutí je pokyn „tohle teď nikomu neukazuj"),
 *  - má vyplněný a čitelný odkaz (bez ID složky by se stejně neotevřela),
 *  - člověk ji má zaškrtnutou; superadmin je výjimka a vidí všechny.
 *
 * Záměrně se NEVRACÍ složky, na které člověk nemá: portál o nich nesmí dát
 * vědět ani tím, že je ukáže zašedlé. Kdo je nemá, o nich neví.
 */
export function nabidkaSlozek(vsechny: SlozkaKNabidce[], superadmin: boolean): NabidnutaSlozka[] {
  const vybrane: NabidnutaSlozka[] = [];
  for (const slozka of vsechny) {
    if (!slozka.aktivni) continue;
    if (!slozka.rootId) continue;
    if (!superadmin && !slozka.prideleno) continue;
    vybrane.push({
      id: slozka.id,
      nazev: slozka.nazev,
      popis: slozka.popis,
      rootId: slozka.rootId,
    });
  }
  return vybrane;
}
