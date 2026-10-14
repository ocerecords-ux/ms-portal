/**
 * SÉRIE AUDIOKNIH (zadání 14. 10. 2026). Název série je prostý text, takže
 * „Tajemství rodu Musovských" a „tajemstvi rodu  musovskych" je pro člověka
 * tatáž série a pro databázi ne. Všechno porovnávání jde proto přes `klicSerie`.
 */

/** Porovnávací podoba názvu - bez diakritiky, malými, zbytečné mezery pryč. */
export function klicSerie(nazev: string | null | undefined): string {
  return (nazev ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

type SProjekt = { id: number; name: string; serie?: string | null; serieDil?: number | null };

/**
 * Díly jedné série ze seznamu, který volající už má v ruce - žádný další
 * dotaz. Klient tím v okénku uvidí jen díly své firmy, my všechny.
 *
 * Řadí se podle čísla dílu; co číslo nemá, jde nakonec podle názvu.
 */
export function dilySerie(vsechny: SProjekt[], serie: string | null | undefined): { id: number; name: string; dil: number | null }[] {
  const klic = klicSerie(serie);
  if (!klic) return [];
  return vsechny
    .filter((p) => klicSerie(p.serie) === klic)
    .map((p) => ({ id: p.id, name: p.name, dil: p.serieDil ?? null }))
    .sort((a, b) => {
      if (a.dil != null && b.dil != null) return a.dil - b.dil;
      if (a.dil != null) return -1;
      if (b.dil != null) return 1;
      return a.name.localeCompare(b.name, 'cs');
    });
}

/**
 * Název do e-mailu a do předmětu (upřesnění 14. 10. 2026: „ano, zmíníme to
 * i v emailech"). V portálu série visí u názvu jako kolečko, v poště takhle
 * být nemůže - tam se napíše celá.
 *
 * Bez série vrací jen název, takže se dá volat všude bez rozmýšlení.
 */
export function nazevSeSerii(
  nazev: string | null | undefined,
  serie?: string | null,
  dil?: number | null,
): string {
  const kniha = (nazev ?? '').trim();
  const s = (serie ?? '').trim();
  if (!s) return kniha;
  const cast = dil != null ? `${s} ${dil}` : s;
  return kniha ? `${cast} · ${kniha}` : cast;
}

/** Nejvýš dvouciferné celé číslo - musí se vejít do kolečka u názvu. */
export function cisloDilu(vstup: unknown): number | null {
  const n = typeof vstup === 'number' ? vstup : parseInt(String(vstup ?? '').trim(), 10);
  if (!Number.isFinite(n) || n < 1 || n > 99) return null;
  return Math.trunc(n);
}
