/**
 * ÚKOL ZADANÝ Z CHATU (zadání 18. 9. 2026: „potřebuju do chatu dát možnost,
 * když dám @ukol, tak budu mít možnost přiřadit úkol konkrétnímu uživateli
 * a propíše se mu do to-do listu").
 *
 * Jak to má chodit, upřesnil hned nato: „aby si vzal text, osoba automaticky,
 * komu píšu; když je to ve skupině, tak ho musím označit a vyberu jen datum.
 * A dát možnost i bez data."
 *
 * Z toho plyne celé chování:
 * - text úkolu je zbytek zprávy (bez značky a bez zmínky příjemce),
 * - v soukromé konverzaci je příjemcem ten druhý, nikde se nevybírá,
 * - ve skupině a v kanálu projektu ho musí zadavatel označit @jménem,
 * - termín je nepovinný.
 *
 * Soubor je záměrně bez Prismy, aby si ho mohl vzít i panel v prohlížeči -
 * ten podle stejných pravidel ukazuje, komu úkol poletí, ještě před odesláním.
 */

/** Značka na začátku slova; „@ukol" i „@úkol", velikost písmen je jedno. */
const ZNACKA = /(^|\s)@[uú]kol(?![\p{L}\p{N}])/iu;

/** Co se do textu doplní, když si člověk vybere úkol z nabídky zmínek. */
export const ZNACKA_UKOLU = 'úkol';

/** Je tahle zpráva zadáním úkolu? */
export function jeUkol(text: string): boolean {
  return ZNACKA.test(text ?? '');
}

/**
 * Patří rozepsaná zmínka k úkolu? Podle toho se do nabídky pod @ přidá
 * řádek „úkol" — člověk ho nemusí znát, stačí, že píše @u a vidí ho.
 */
export function hledaUkol(hledani: string): boolean {
  const h = (hledani ?? '').toLowerCase();
  return h.length === 0 || ZNACKA_UKOLU.startsWith(h) || 'ukol'.startsWith(h);
}

/**
 * Text úkolu: zpráva bez značky a bez zmínky toho, komu úkol patří.
 *
 * Zmínka příjemce se vyhazuje schválně - „@úkol @Bára zavolat do studia" je
 * úkol „zavolat do studia", ne úkol, který si sám sebe jmenuje. Ostatní
 * zmínky ve větě zůstávají: „domluvit to s @Karolínou" dává smysl i v to-do
 * listu.
 */
export function nazevUkolu(text: string, jmenoPrijemce?: string | null): string {
  let zbytek = (text ?? '').replace(ZNACKA, ' ');
  const jmeno = jmenoPrijemce?.trim();
  if (jmeno) {
    // Cele jmeno i samotne krestni - v chatu se pouziva oboji.
    const podoby = [jmeno, jmeno.split(/\s+/)[0]].filter((p) => p.length >= 3);
    for (const podoba of podoby) {
      const utek = podoba.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      /**
       * Konec jména se hlídá pohledem dopředu, ne `\b`: `\b` zná jen anglickou
       * abecedu, takže za „Šiblová" žádnou hranici nevidí a jméno se pak
       * smazalo jen napůl („@Bára Šiblová" → „Šiblová").
       */
      zbytek = zbytek.replace(new RegExp(`(^|\\s)@${utek}(?![\\p{L}\\p{N}])`, 'iu'), ' ');
    }
  }
  return zbytek.replace(/\s+/g, ' ').trim();
}

export const CHYBI_PRIJEMCE = 'Označte @jménem, komu úkol patří.';
export const CHYBI_NAZEV = 'Napište, co je potřeba udělat.';
