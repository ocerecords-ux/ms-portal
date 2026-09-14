/**
 * ROZDĚLENÍ SMLOUVY NA STRÁNKY (zadání 13. 9. 2026: „bylo by dobré, abys
 * odklikával i jednotlivé stránky, jak je to třeba u Signi").
 *
 * Naše smlouva žádné stránky nemá — tělo je prostý text a sazba se dělá až
 * v prohlížeči (viz ContractPaper). Stránka je tedy něco, co si musíme
 * spočítat sami.
 *
 * MUSÍ TO BÝT DETERMINISTICKÉ. U podpisu se ukládá, kolik stránek člověk
 * odklikal; kdyby se text rozdělil pokaždé jinak, nešlo by po roce říct, co
 * vlastně viděl. Proto se nepočítá nic, co závisí na okně prohlížeče nebo na
 * písmu — jen na samotném textu.
 *
 * NELÁME SE POD NADPISEM. Článek, kterému by na stránce zbyl jen titulek,
 * se celý odsune na další — jinak by člověk odklikl stránku končící slovy
 * „III. ODMĚNA" a o odměně by na ní nebylo ani slovo.
 */

/** Kolik „váhy" se vejde na stránku. Číslo je odladěné na běžnou smlouvu. */
const VAHA_STRANKY = 26;

/**
 * Kolik místa řádek zabere. Prázdný řádek je mezera, dlouhý odstavec se
 * v sazbě zalomí na několik řádků — proto ta délka.
 */
function vahaRadku(radek: string): number {
  const text = radek.trim();
  if (!text) return 1;
  return 1 + Math.floor(text.length / 70);
}

/** Poznámka: stejné pravidlo jako druhRadku v ContractPaper, jen zjednodušené. */
function jeNadpis(radek: string): boolean {
  const text = radek.trim();
  if (!text || text.length > 90 || text.includes(':')) return false;
  const bezCisla = text.replace(/^[\dIVXL]+([.)]\d*)*[.)]?\s+/i, '');
  const pismena = bezCisla.replace(/[^\p{L}]/gu, '');
  if (pismena.length >= 3 && !/\d/.test(bezCisla) && pismena === pismena.toLocaleUpperCase('cs-CZ')) {
    return true;
  }
  return /^[IVXL]{1,5}\.\s+\p{Lu}/u.test(text);
}

/**
 * Rozdělí tělo smlouvy na stránky. Vrací text každé stránky; spojením zpátky
 * přes „\n" vznikne původní tělo, takže se stránkováním nic neztrácí.
 */
export function rozdelNaStranky(body: string): string[] {
  const radky = body.replace(/\r\n/g, '\n').split('\n');
  const stranky: string[][] = [];
  let stranka: string[] = [];
  let vaha = 0;

  for (let i = 0; i < radky.length; i++) {
    const radek = radky[i];

    // Nadpis, pod kterym uz by na strance nic nezbylo, patri na dalsi.
    if (stranka.length > 0 && jeNadpis(radek) && vaha + 6 > VAHA_STRANKY) {
      stranky.push(stranka);
      stranka = [];
      vaha = 0;
    }

    stranka.push(radek);
    vaha += vahaRadku(radek);

    // Lame se az za prazdnym radkem, at se odstavec nerozpulí.
    if (vaha >= VAHA_STRANKY && !radky[i + 1]?.trim()) {
      stranky.push(stranka);
      stranka = [];
      vaha = 0;
    }
  }

  if (stranka.length > 0) stranky.push(stranka);
  // Prazdna smlouva je porad jedna stranka - jinak by nebylo co odklikat.
  if (stranky.length === 0) return [''];
  return stranky.map((s) => s.join('\n'));
}

/** Kolik stránek smlouva má. Zvlášť, ať se kvůli číslu nemusí skládat texty. */
export function pocetStranek(body: string): number {
  return rozdelNaStranky(body).length;
}
