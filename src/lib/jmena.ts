/**
 * Jméno herce bez titulů (zadání 15. 9. 2026: „u těch herců všude v portálu
 * nezobrazovat tituly před a za jménem. Např. Mgr. apod.").
 *
 * Tituly se z karty herce NEMAŽOU - na kartě i ve fakturačních údajích
 * zůstávají tak, jak je má člověk zapsané. Jen se nevypisují tam, kde se
 * jméno ukazuje jako jméno: v bublině u projektu, v nabídkách, ve smlouvě.
 *
 * Bez Prismy - používá to i prohlížeč.
 */

/** Tituly PŘED jménem. Bez teček a diakritiky, malými písmeny. */
const PRED_JMENEM = new Set([
  'bc', 'bca', 'ing', 'ingarch', 'mudr', 'mvdr', 'mga', 'mgr', 'judr', 'phdr',
  'rndr', 'pharmdr', 'thlic', 'thdr', 'paeddr', 'rsdr', 'dr', 'phmr', 'mddr',
  'prof', 'doc', 'akad', 'arch', 'mag',
]);

/** Tituly ZA jménem. */
const ZA_JMENEM = new Set([
  'phd', 'csc', 'drsc', 'thd', 'dis', 'mba', 'llm', 'ba', 'ma', 'msc', 'dba',
  'artd', 'bba', 'mha', 'ph', 'd',
]);

/** Porovnávací tvar kousku jména - bez teček, čárek a diakritiky. */
function klic(kousek: string): string {
  return kousek
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[.,]/g, '')
    .toLowerCase();
}

export function bezTitulu(jmeno: string | null | undefined): string {
  const cele = (jmeno ?? '').trim();
  if (!cele) return '';

  /**
   * I TITUL PŘILEPENÝ K JMÉNU (oprava 16. 10. 2026: „v těch bublinách
   * u herců by neměly svítit tituly"). „MgA.Robert Jícha" se píše bez mezery
   * za tečkou - dělení podle mezer z toho udělalo jeden kus „MgA.Robert",
   * který žádnému titulu neodpovídá, a titul zůstal svítit v bublině.
   *
   * Dělí se proto i za tečkou. „Ph.D." se tím rozpadne na „Ph" a „D" - oba
   * kusy seznam titulů za jménem zná, takže to vyjde nastejno.
   */
  const kousky = cele.replace(/\.(?=[^\s.])/g, '. ').split(/\s+/);
  const puvodniPocet = kousky.length;
  // Zepředu: „Mgr. Jan Novák" i „doc. Ing. Jan Novák".
  while (kousky.length > 1 && PRED_JMENEM.has(klic(kousky[0]))) kousky.shift();
  // Zezadu: „Jan Novák, Ph.D." i „Jan Novák DiS.".
  while (kousky.length > 1 && ZA_JMENEM.has(klic(kousky[kousky.length - 1]))) kousky.pop();

  // Když se nic neodebralo, vrací se PŮVODNÍ ZÁPIS - rozdělování za tečkou
  // je jen pomůcka pro hledání titulů a nesmí nikomu přepsat jméno.
  if (kousky.length === puvodniPocet) return cele;

  const vysledek = kousky.join(' ').replace(/[,\s]+$/, '').trim();
  // Kdyby z jména nic nezbylo (samé tituly), radši vrátíme původní zápis.
  return vysledek || cele;
}
