import { HEREC_STUDIOS } from '@/lib/roles';

/**
 * Barvy lokací herců (zadání 10. 9. 2026: „udělal bych paletu barevnou na
 * herce, podle lokace. Brno může být pod jednou").
 *
 * V seznamu herců je lokace to, podle čeho se hledá nejčastěji — kdo umí
 * natáčet v Brně, kdo v Praze. Barva to udělá čitelné na jeden pohled;
 * text „MS Studio - Brno II" se čte pomalu a všechny řádky vypadají stejně.
 *
 * BRNO MÁ JEDNU BARVU. Brno I a Brno II jsou dvě místnosti v jednom městě —
 * pro rozhodování „kam ho pozvat" je to totéž. Rozlišuje je text, ne barva.
 */

/** Město, podle kterého se barví. Co nepoznáme, dostane neutrální šedou. */
function mesto(lokace: string): string {
  const bez = lokace
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
  if (bez.includes('brno')) return 'brno';
  if (bez.includes('praha') || bez.includes('prague')) return 'praha';
  if (bez.includes('london') || bez.includes('londyn')) return 'london';
  return 'jine';
}

/**
 * Barvy jsou schválně jiné než u stavů projektu (lib/stavyProjektu.ts).
 * Lokace herce a stav projektu se potkávají na jedné obrazovce a stejný
 * odstín ve dvou významech je horší než žádná barva.
 */
const BARVY: Record<string, string> = {
  brno: 'bg-teal-100 text-teal-800 border-teal-300 dark:bg-teal-500/20 dark:text-teal-200 dark:border-teal-400/40',
  praha: 'bg-pink-100 text-pink-800 border-pink-300 dark:bg-pink-500/20 dark:text-pink-200 dark:border-pink-400/40',
  london:
    'bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-indigo-500/20 dark:text-indigo-200 dark:border-indigo-400/40',
  jine: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-500/20 dark:text-slate-200 dark:border-slate-400/40',
};

/** Třídy odznaku lokace - podklad, text a rámeček. */
export function barvaLokace(lokace: string): string {
  return `border ${BARVY[mesto(lokace)] ?? BARVY.jine}`;
}

/**
 * Kratší popisek do odznaku. „MS Studio - " má každá lokace stejné, takže
 * v seznamu jen zabírá místo a nic nerozlišuje.
 */
export function popisekLokace(lokace: string): string {
  return lokace.replace(/^MS\s*Studio\s*-\s*/i, '').trim() || lokace;
}

/** Legenda k paletě - používá se tam, kde se lokace zaškrtávají. */
export const LOKACE_S_BARVOU = HEREC_STUDIOS.map((l) => ({
  nazev: l,
  popisek: popisekLokace(l),
  barva: barvaLokace(l),
}));
