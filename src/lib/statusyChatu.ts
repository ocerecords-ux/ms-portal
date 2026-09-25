/**
 * STATUSY V CHATU (zadání 25. 9. 2026: „potřeboval bych nastavit ještě nějaké
 * statusy v chatu. Když třeba budu mít schůzku, tak by se tam objevilo: Mám
 * schůzku do 14:30. Data by to tahalo automaticky z kalendáře. U těch režií mi
 * tam nastav, že jsem mimo jen první půl hodinu. U castingu na celou událost.
 * Tohle nastav jen mi. A zbytku pak jen nějakou možnost nastavit si
 * individuální status. A nám všem bych nastavil, když budeme mimo studio").
 *
 * Tenhle soubor nesahá do databáze - používá ho i chat v prohlížeči. Skládání
 * statusu z kalendáře je v lib/statusyServer.ts.
 *
 * TŘI ZDROJE, V TOMHLE POŘADÍ:
 *   1. co si člověk napsal sám (a dokud to platí),
 *   2. „Mimo studio" z kalendáře - platí všem,
 *   3. kalendář (porada, schůzka, casting, režie) - jen tomu, kdo to má
 *      zapnuté na kartě uživatele.
 * Ručně napsaný status má přednost schválně: kdo si ho nastavil, ví o sobě
 * víc než kalendář.
 */

export type StatusVChatu = {
  /** Celá věta, jak se ukáže: „Mám schůzku do 14:30". */
  text: string;
  emoji: string | null;
  /** ISO čas, do kdy status platí; null = dokud ho člověk nesmaže. */
  doKdy: string | null;
  /** Napsal si ho člověk sám? Jinak je z kalendáře. */
  rucni: boolean;
};

/**
 * REŽIE NA DÁLKU JEN PRVNÍ PŮLHODINU (zadání 25. 9. 2026). Frekvence běží
 * čtyři hodiny, ale na dálku se u ní sedí jen na začátku, než se to rozjede -
 * status na celou dobu by lhal celé odpoledne.
 */
export const REZIE_MINUT = 30;

/** „14:30" v čase Prahy - status se čte očima, ne strojem. */
export function casStatusu(kdy: Date | string): string {
  const d = typeof kdy === 'string' ? new Date(kdy) : kdy;
  return new Intl.DateTimeFormat('cs-CZ', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Prague',
  }).format(d);
}

/** Nabídka „do kdy" u ručního statusu. */
export const DOKDY_NABIDKA: { klic: string; popisek: string; minut: number | null }[] = [
  { klic: '30', popisek: '30 minut', minut: 30 },
  { klic: '60', popisek: '1 hodinu', minut: 60 },
  { klic: '240', popisek: '4 hodiny', minut: 240 },
  { klic: 'dnes', popisek: 'do konce dne', minut: null },
  { klic: 'bez', popisek: 'dokud ho nezruším', minut: null },
];

/** Pár hotových statusů na jedno klepnutí - psát „Na obědě" ručně je zbytečné. */
export const HOTOVE_STATUSY: { emoji: string; text: string; klicDokdy: string }[] = [
  { emoji: '🍽️', text: 'Na obědě', klicDokdy: '60' },
  { emoji: '🎧', text: 'Ve studiu', klicDokdy: '240' },
  { emoji: '🚗', text: 'Na cestě', klicDokdy: '60' },
  { emoji: '🤫', text: 'Soustředím se', klicDokdy: '240' },
  { emoji: '🏠', text: 'Pracuji z domu', klicDokdy: 'dnes' },
];

/** Text statusu i s časem, když nějaký má. */
export function popisStatusu(status: StatusVChatu): string {
  if (!status.doKdy) return status.text;
  // „do" už ve větě je (kalendářní statusy si ho nesou samy).
  return / do \d/.test(status.text) ? status.text : `${status.text} do ${casStatusu(status.doKdy)}`;
}
