/**
 * KTERÁ POLOŽKA ROZPOČTU PATŘÍ HERCI (zadání 17. 9. 2026: „u smlouvy reklamy
 * budeme taky vybírat prakticky jen herce, takže by to mělo jít vybrat
 * automaticky i s cenou jako položka rozpočtu herec u daného projektu").
 *
 * Náklady projektu jsou volný text („Herec - Jan Novák", „Jan Novák",
 * „honorář herce"), takže vazba na účet herce v databázi není. Hádá se tedy
 * z názvu - ale opatrně: špatně dosazená částka ve smlouvě je horší než
 * prázdné pole, které si člověk vyplní sám.
 *
 * Pořadí, ve kterém se hledá:
 *   1. položka, jejíž název obsahuje celé jméno herce,
 *   2. položka, jejíž název obsahuje jeho příjmení,
 *   3. jediná položka se slovem „herec/herečka/honorář", a to jen když je
 *      na projektu jediný herec - u dvojhlasu by se netrefila.
 *
 * Když na některém kroku sedí VÍC položek, nevrací se nic: dvě čísla znamenají,
 * že to musí rozhodnout člověk.
 */

export type NakladProjektu = { nazev: string; castka: number };

/** Bez diakritiky a malými písmeny - „Černý" a „Cerny" musí sedět. */
function srovnej(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/** Slova jména bez titulů a zkratek - z „Mgr. Jan Novák" zbude jan, novak. */
function slovaJmena(jmeno: string): string[] {
  return srovnej(jmeno)
    .replace(/[.,]/g, ' ')
    .split(/\s+/)
    .filter((s) => s.length >= 3);
}

const SLOVA_HONORARE = ['herec', 'herečka', 'herecka', 'honorar', 'honorář'];

/**
 * Index položky, která patří hercovi, nebo `null`.
 *
 * @param naklady položky rozpočtu projektu v pořadí, v jakém se nabízejí
 * @param jmeno jméno vybraného herce
 * @param pocetHercu kolik herců je na projektu (kvůli kroku 3)
 */
export function najdiNakladHerce(
  naklady: NakladProjektu[],
  jmeno: string,
  pocetHercu = 1,
): number | null {
  const cele = srovnej(jmeno);
  if (!cele || naklady.length === 0) return null;
  const nazvy = naklady.map((n) => srovnej(n.nazev));

  const jediny = (indexy: number[]): number | null => (indexy.length === 1 ? indexy[0] : null);

  const podleCelehoJmena = nazvy.flatMap((n, i) => (n.includes(cele) ? [i] : []));
  const nalez = jediny(podleCelehoJmena);
  if (nalez !== null) return nalez;

  // Příjmení bereme jako poslední slovo jména - „Jan Novák" -> novak.
  const slova = slovaJmena(jmeno);
  const prijmeni = slova[slova.length - 1];
  if (prijmeni) {
    const podlePrijmeni = nazvy.flatMap((n, i) => (n.includes(prijmeni) ? [i] : []));
    const nalezP = jediny(podlePrijmeni);
    if (nalezP !== null) return nalezP;
  }

  if (pocetHercu === 1) {
    const podleSlova = nazvy.flatMap((n, i) =>
      SLOVA_HONORARE.some((s) => n.includes(srovnej(s))) ? [i] : [],
    );
    return jediny(podleSlova);
  }

  return null;
}
