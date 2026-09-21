/**
 * PROCENTO PŘEPOSLECHU PODLE STRAN PDF (zadání 21. 9. 2026: „Když má klient
 * knihu na přeposlech v AudioTaggeru, potřeboval bych, aby se mu ukazovala
 * procenta, kolik má přeposlechnuto. Ale tracky tam většinou dáváme po
 * kouskách. Takže by to mělo brát asi informace z PDF. Celkový počet
 * stran / kde zrovna je").
 *
 * Stopy nejsou měřítko - kniha přichází po kouscích a „3 z 5" neřekne nic
 * o tom, kolik z celé knihy je za námi. Text je naopak celý od začátku.
 *
 * Jak se strana počítá jako slyšená: AudioTagger každých deset vteřin
 * PŘEHRÁVÁNÍ pošle, na které straně PDF klient zrovna je. Ta strana se
 * zapíše. Jen prolistování textu bez puštěné nahrávky se nepočítá, a kdo text
 * přeroluje na konec, zatímco hraje, zapíše tím jen tu jednu stranu, ne
 * všechny mezi tím. Stránka má minutu i víc zvuku, takže při normálním
 * poslechu se chytí každá; kdyby klient otočil o dvě naráz, doplní se i ta
 * přeskočená (skok nejvýš o MAX_SKOK stran).
 *
 * Tenhle soubor nesahá do databáze - používá ho server i prohlížeč.
 */

/** Největší skok mezi dvěma zápisy, u kterého se strany mezi tím berou jako slyšené. */
export const MAX_SKOK = 3;

export type PostupPreposlechu = {
  /** Kolik různých stran klient slyšel. */
  slyseno: number;
  /** Kolik stran má PDF. */
  stran: number;
  /** 0-100, zaokrouhleno dolů - 100 % až opravdu u všech stran. */
  procent: number;
};

export function spocitejPostup(slyseneStrany: number[], stran: number | null | undefined): PostupPreposlechu | null {
  if (!stran || stran <= 0) return null;
  const slyseno = new Set(slyseneStrany.filter((s) => s >= 1 && s <= stran)).size;
  return { slyseno, stran, procent: Math.min(100, Math.floor((slyseno / stran) * 100)) };
}

/**
 * Nové slyšené strany po jednom zápisu. `predchozi` je strana z minulého
 * zápisu téhož posluchače; když se od ní posunul o 2-3 strany dopředu, patří
 * mezi slyšené i ty mezi tím.
 */
export function pridejStrany(
  dosud: number[],
  strana: number,
  predchozi: number | null | undefined,
  stran: number,
): number[] {
  const nove = new Set(dosud.filter((s) => s >= 1 && s <= stran));
  if (strana >= 1 && strana <= stran) {
    nove.add(strana);
    if (predchozi && strana > predchozi && strana - predchozi <= MAX_SKOK) {
      for (let s = predchozi + 1; s < strana; s++) nove.add(s);
    }
  }
  return Array.from(nove).sort((a, b) => a - b);
}
