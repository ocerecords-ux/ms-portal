/**
 * ÚVOD A ZÁVĚR AUDIOKNIHY (zadání 22. 9. 2026: „u firmy Audiotéka potřebuju
 * mít ještě v objednávce audioknihy takovou vychytávku, kde se bude
 * automaticky generovat úvod a závěr audioknihy. Klient by měl v objednávce
 * zadat tyto proměnné: název knihy, autora a překladatele. Samozřejmě musí
 * být možnost to editovat nebo vložit vlastní celý text. Režisér na konci je
 * vždy Ondřej Černý").
 *
 * Vzor od Audiotéky:
 *   Úvod:  Audiotéka uvádí audioknihu Retrokrimi - Kriminální případy z let
 *          1883 až 1961. Napsal Emil Hruška, čte xy.
 *   Závěr: Emil Hruška: Retrokrimi - Kriminální případy z let 1883 až 1961.
 *          Připravila Audiotéka podle stejnojmenné knihy vydané nakladatelstvím
 *          Epocha. Režie Ondřej Černý. Děkujeme za poslech a budeme rádi, když
 *          k audioknize přidáte své hodnocení. Audiotéka, dobře podané příběhy.
 *
 * Čistý modul bez databáze - používá ho formulář objednávky v prohlížeči.
 */

export const REZISER_UVODU = 'Ondřej Černý';

/** Zástupný text za herce, dokud ho neznáme - v textu je hned vidět. */
export const HEREC_ZATIM = '[herec]';

/** Firma, které se v objednávce úvod a závěr nabízí (zatím jen Audiotéka). */
export function firmaChceUvodZaver(nazevFirmy: string | null | undefined): boolean {
  return /audiot[eé]k/i.test(nazevFirmy ?? '');
}

export type UdajeUvodu = {
  nazev: string;
  autor: string;
  prekladatel: string;
  nakladatelstvi: string;
  /** Herec, pokud ho klient vybral - jinak zůstane zástupný text. */
  herec: string;
};

/**
 * Rod slovesa podle jména: víc lidí → „Napsali", žena → „Napsala".
 * Ženu pozná podle příjmení na -ová / -á (Nováková, Horáková, Černá) -
 * u výjimek se text prostě opraví ručně.
 */
function tvar(jmeno: string, muz: string, zena: string, vice: string): string {
  const j = jmeno.trim();
  if (/,|\s+a\s+|\s*&\s*/.test(j)) return vice;
  const prijmeni = j.split(/\s+/).pop() ?? '';
  return /(ová|á)$/i.test(prijmeni) ? zena : muz;
}

function vetaBezTecky(t: string): string {
  return t.trim().replace(/[.\s]+$/, '');
}

export function vygenerujUvod(u: UdajeUvodu): string {
  const nazev = vetaBezTecky(u.nazev) || '[název]';
  const autor = u.autor.trim();
  const prekladatel = u.prekladatel.trim();
  const herec = u.herec.trim() || HEREC_ZATIM;

  const casti: string[] = [];
  if (autor) casti.push(`${tvar(autor, 'Napsal', 'Napsala', 'Napsali')} ${autor}`);
  if (prekladatel) casti.push(`${autor ? tvar(prekladatel, 'přeložil', 'přeložila', 'přeložili') : tvar(prekladatel, 'Přeložil', 'Přeložila', 'Přeložili')} ${prekladatel}`);
  casti.push(`${casti.length ? 'čte' : 'Čte'} ${herec}`);

  return `Audiotéka uvádí audioknihu ${nazev}. ${casti.join(', ')}.`;
}

export function vygenerujZaver(u: UdajeUvodu): string {
  const nazev = vetaBezTecky(u.nazev) || '[název]';
  const autor = u.autor.trim();
  const prekladatel = u.prekladatel.trim();
  const nakladatelstvi = vetaBezTecky(u.nakladatelstvi);

  const vety: string[] = [];
  vety.push(autor ? `${autor}: ${nazev}.` : `${nazev}.`);
  if (prekladatel) vety.push(`${tvar(prekladatel, 'Přeložil', 'Přeložila', 'Přeložili')} ${prekladatel}.`);
  vety.push(
    nakladatelstvi
      ? `Připravila Audiotéka podle stejnojmenné knihy vydané nakladatelstvím ${nakladatelstvi}.`
      : 'Připravila Audiotéka podle stejnojmenné knihy.',
  );
  vety.push(`Režie ${REZISER_UVODU}.`);
  vety.push('Děkujeme za poslech a budeme rádi, když k audioknize přidáte své hodnocení.');
  vety.push('Audiotéka, dobře podané příběhy.');
  return vety.join(' ');
}
