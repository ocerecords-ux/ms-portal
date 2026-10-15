/**
 * FREKVENCE PROJEKTU - ČISTÉ FUNKCE (připomínka Helči 15. 10. 2026: „bylo by
 * buď datum první frekvence a nebo úplně nejlépe počet dní do první frekvence.
 * Hodilo by se mi, kdybych si mohla ty projekty seřadit právě od první
 * frekvence").
 *
 * Bez Prismy, ať to může použít i prohlížeč (odznak u názvu projektu).
 */

/** Jak daleko je termín - podle toho se barví ikona kalendáře u názvu. */
export type BlizkostTerminu = 'dnes' | 'brzy' | 'klid' | 'minulost';

/**
 * Počet dní do termínu PO DNECH, ne po hodinách (rozhodnutí 15. 10. 2026).
 *
 * Kdyby se počítalo po hodinách, svítilo by v pátek večer u pondělního rána
 * „za 2 dny" a nikdo by nevěděl, který den to je. Oba časy se proto nejdřív
 * srazí na půlnoc a teprve pak odečtou.
 */
export function dniDo(termin: Date, ted: Date = new Date()): number {
  const a = new Date(termin.getFullYear(), termin.getMonth(), termin.getDate()).getTime();
  const b = new Date(ted.getFullYear(), ted.getMonth(), ted.getDate()).getTime();
  return Math.round((a - b) / 86_400_000);
}

/**
 * Barva ikony. Hranice je TÝDEN: do týdne se počítá, kolikátý je to den,
 * dál už člověka zajímá jen datum.
 */
export function blizkost(termin: Date | null, ted: Date = new Date()): BlizkostTerminu | null {
  if (!termin) return null;
  const dni = dniDo(termin, ted);
  if (dni < 0) return 'minulost';
  if (dni <= 1) return 'dnes';
  if (dni <= 7) return 'brzy';
  return 'klid';
}

/** „dnes" · „zítra" · „za 3 dny" · „28. 10." - do týdne odpočet, dál datum. */
export function popisTerminu(
  termin: Date,
  t: (klic: string, data?: Record<string, string | number>) => string,
  ted: Date = new Date(),
): string {
  const dni = dniDo(termin, ted);
  if (dni < 0) return datumKratce(termin);
  if (dni === 0) return t('frekvence.dnes');
  if (dni === 1) return t('frekvence.zitra');
  // Čeština počítá jinak do čtyř a jinak od pěti: „za 3 dny", ale „za 5 dnů".
  if (dni <= 7) return t(dni <= 4 ? 'frekvence.zaDny' : 'frekvence.zaDnu', { pocet: dni });
  return datumKratce(termin);
}

/** „28. 10." - bez roku, v přehledu by jen zabíral. */
export function datumKratce(d: Date): string {
  return `${d.getDate()}. ${d.getMonth() + 1}.`;
}
