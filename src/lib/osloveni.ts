/**
 * Oslovení v 5. pádu (zadání 11. 9. 2026: „musíme ta jména v úvodu v češtině
 * skloňovat. Takže: Dobrý den, Radko,").
 *
 * Do té doby portál psal „Dobrý den, Radka," — česky to zní jako cedulka, ne
 * jako dopis.
 *
 * Skloňuje se JEN KŘESTNÍ JMÉNO, tedy první slovo uloženého jména (tituly se
 * přeskočí). Skloňovat i příjmení („Dobrý den, Radko Nováková,") by bylo
 * formálnější, než jak si s klienty píšeme.
 *
 * Soubor je záměrně bez jakýchkoli závislostí — používá ho i náhled vzoru
 * v prohlížeči.
 */

/** Tituly před jménem i za ním. Ve jméně je přeskočíme. */
const TITULY = new Set([
  'ing', 'mgr', 'mga', 'bc', 'bca', 'judr', 'mudr', 'mvdr', 'phdr', 'rndr',
  'paeddr', 'thdr', 'pharmdr', 'dr', 'doc', 'prof', 'dis', 'csc', 'drsc',
  'phd', 'ph.d', 'mba', 'akad',
]);

/**
 * Jména, která pravidla netrefí.
 *
 * Dvě skupiny: mužská s prchavým -e- (Pavel → Pavle) nebo cizí zakončení
 * (Alex → Alexi), a ženská zakončená na souhlásku, která se v češtině
 * neskloňují vůbec (Dagmar, Ester, Nikol).
 */
const VYJIMKY: Record<string, string> = {
  // Prchavé -e-: Pavel → Pavle, ale Marcel → Marceli (ne „Marcle").
  pavel: 'Pavle',
  karel: 'Karle',
  havel: 'Havle',
  marcel: 'Marceli',
  daniel: 'Danieli',
  gabriel: 'Gabrieli',
  samuel: 'Samueli',
  emanuel: 'Emanueli',
  michael: 'Michaeli',
  rafael: 'Rafaeli',
  ariel: 'Arieli',
  // Zakončení, které pravidla neznají.
  alex: 'Alexi',
  max: 'Maxi',
  felix: 'Felixi',
  // Ženská jména na souhlásku - nesklonná.
  dagmar: 'Dagmar',
  ester: 'Ester',
  esther: 'Esther',
  miriam: 'Miriam',
  mirjam: 'Mirjam',
  karin: 'Karin',
  ingrid: 'Ingrid',
  nikol: 'Nikol',
  rachel: 'Rachel',
  ruth: 'Ruth',
  doris: 'Doris',
  iris: 'Iris',
  carmen: 'Carmen',
  jasmin: 'Jasmin',
  yasmin: 'Yasmin',
  sharon: 'Sharon',
  sarah: 'Sarah',
  hannah: 'Hannah',
  deborah: 'Deborah',
  judith: 'Judith',
  edith: 'Edith',
  agnes: 'Agnes',
  mercedes: 'Mercedes',
};

const SAMOHLASKY = 'aáeéěiíoóuúůyý';
/** Měkké souhlásky - po nich se v 5. pádu píše -i (Tomáši, Ondřeji). */
const MEKKE = 'žščřcjďťň';

function maleJmeno(s: string): string {
  return s.toLocaleLowerCase('cs-CZ');
}

/** Souhláska pro naše účely = písmeno, které není samohláska. */
function jeSouhlaska(znak: string): boolean {
  return !!znak && /\p{L}/u.test(znak) && !SAMOHLASKY.includes(maleJmeno(znak));
}

/** Zdeněk → Zdeňku, Luděk → Luďku: před -ku se d/t/n změkčí. */
function zmekci(zaklad: string): string {
  const posledni = zaklad.slice(-1);
  const zbytek = zaklad.slice(0, -1);
  if (posledni === 'd') return `${zbytek}ď`;
  if (posledni === 't') return `${zbytek}ť`;
  if (posledni === 'n') return `${zbytek}ň`;
  if (posledni === 'D') return `${zbytek}Ď`;
  if (posledni === 'T') return `${zbytek}Ť`;
  if (posledni === 'N') return `${zbytek}Ň`;
  return zaklad;
}

/**
 * Jedno slovo do 5. pádu. Rozeznávat mužská a ženská jména není potřeba —
 * zakončení na -a se chová stejně u obou (Radka → Radko, Honza → Honzo).
 */
function patyPad(slovo: string): string {
  const male = maleJmeno(slovo);
  if (VYJIMKY[male]) return VYJIMKY[male];
  if (slovo.length < 2) return slovo;

  const posledni = male.slice(-1);

  // Zakončení na samohlásku.
  if (SAMOHLASKY.includes(posledni)) {
    // Radka → Radko, Honza → Honzo. Ostatní samohlásky se nemění
    // (Jiří, Lucie, Marie, Ivo, Hugo, Naty).
    return posledni === 'a' || posledni === 'á' ? `${slovo.slice(0, -1)}o` : slovo;
  }

  // Měkká souhláska: Tomáš → Tomáši, Ondřej → Ondřeji, Aleš → Aleši.
  if (MEKKE.includes(posledni)) return `${slovo}i`;

  // Zakončení na -s: Denis → Denisi, Alois → Aloisi.
  if (posledni === 's' || posledni === 'x' || posledni === 'z') return `${slovo}i`;

  // Vojtěch → Vojtěchu, Oldřich → Oldřichu (dvojznak „ch" dřív než samotné h).
  if (male.endsWith('ch')) return `${slovo}u`;

  // Radek → Radku, Marek → Marku: prchavé -e- vypadne.
  if (male.endsWith('ek')) return `${slovo.slice(0, -2)}ku`;
  // Zdeněk → Zdeňku, Luděk → Luďku: navíc se změkčí souhláska před -ěk.
  if (male.endsWith('ěk')) return `${zmekci(slovo.slice(0, -2))}ku`;

  // Marek → Marku, Dominik → Dominiku, Oleg → Olegu.
  if (posledni === 'k' || posledni === 'h' || posledni === 'g') return `${slovo}u`;

  // Petr → Petře (souhláska před r), ale Viktor → Viktore (samohláska před r).
  if (posledni === 'r') {
    return jeSouhlaska(male.slice(-2, -1)) ? `${slovo.slice(0, -1)}ře` : `${slovo}e`;
  }

  // Jan → Jane, Michal → Michale, Jakub → Jakube, Adam → Adame.
  return `${slovo}e`;
}

/**
 * Oslovení z uloženého jména. Vrací jen křestní jméno v 5. pádu — z „Ing.
 * Radka Nováková" vyleze „Radko". Když jméno rozpoznat nejde, vrátí prázdno
 * a volající napíše prosté „Dobrý den,".
 */
export function oslovit(jmeno: string | null | undefined): string {
  if (!jmeno) return '';
  const slova = jmeno
    .replace(/[,;]/g, ' ')
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s) => !TITULY.has(maleJmeno(s).replace(/\.$/, '')));

  const krestni = slova[0];
  // Jméno se závorkou, číslicí nebo mailem uvnitř radši neskloňujeme —
  // je to spíš poznámka než jméno.
  if (!krestni || !/^\p{L}[\p{L}'-]*$/u.test(krestni)) return '';
  return patyPad(krestni);
}

/**
 * Celý první řádek zprávy. Bez jména „Dobrý den," — nikdy ne „Dobrý den, ,".
 */
export function pozdrav(jmeno: string | null | undefined): string {
  const oslovene = oslovit(jmeno);
  return oslovene ? `Dobrý den, ${oslovene},` : 'Dobrý den,';
}
