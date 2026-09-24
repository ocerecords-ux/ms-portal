/**
 * KONFLIKTY V KALENDÁŘI - společné pro server i prohlížeč.
 *
 * NA KOLIK DNÍ DOPŘEDU SE KOUKÁ. Jedno číslo pro kolečko v liště i pro panel
 * v kalendáři (oprava 24. 9. 2026: „proč mu tam svítí ta tečka u kalendáře,
 * když tam nic není").
 *
 * Do teď počítalo kolečko čtrnáct dní dopředu, ale panel jen to, co bylo
 * zrovna v kalendáři vidět. Kdo měl otevřený dnešek a konflikt až za týden,
 * viděl svítit tečku a po rozkliknutí prázdno - vypadalo to jako chyba,
 * přitom obojí mělo pravdu. Teď se obojí ptá na stejný úsek.
 */
export const DNU_KONFLIKTU = 14;

/** Úsek, na který se koukáme: od teď na DNU_KONFLIKTU dní dopředu. */
export function rozsahKonfliktu(ted: Date = new Date()): { od: Date; doKdy: Date } {
  return { od: ted, doKdy: new Date(ted.getTime() + DNU_KONFLIKTU * 24 * 3600_000) };
}
