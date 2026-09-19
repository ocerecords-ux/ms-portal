/**
 * PROGRES NATÁČENÍ (zadání 19. 9. 2026) - společný tvar pro herce, klienta
 * i detail projektu. Soubor je bez databáze, používá ho i prohlížeč.
 *
 * Počítá se ze STRAN: poslední zapsaná strana („kde jsme skončili") proti
 * počtu stran PDF s textem. Tlačítko Dotočeno znamená 100 %.
 */
export type ProgresNataceni = {
  procenta: number;
  /** „str. 142 z 380" nebo „Dotočeno". */
  popis: string;
  dotoceno: boolean;
  /**
   * Kolik stran zbývá dotočit (zadání 19. 9. 2026: „info o tom, kolik stran
   * zbývá dotočit"). Null u souhrnu víc herců - každý čte jiný díl, součet
   * by nic neříkal; zbytek je u každého herce zvlášť.
   */
  zbyva: number | null;
} | null;

/** „1 strana", „3 strany", „12 stran". */
export function stranText(n: number): string {
  return `${n} ${n === 1 ? 'strana' : n >= 2 && n <= 4 ? 'strany' : 'stran'}`;
}

export function progresZeStran(strana: number | null, stranCelkem: number | null, dotoceno: boolean): ProgresNataceni {
  if (dotoceno) return { procenta: 100, popis: 'Dotočeno', dotoceno: true, zbyva: 0 };
  if (!stranCelkem || stranCelkem <= 0) return null;
  const s = Math.max(0, Math.min(strana ?? 0, stranCelkem));
  return {
    procenta: Math.round((s / stranCelkem) * 100),
    popis: `str. ${s} z ${stranCelkem}`,
    dotoceno: false,
    zbyva: stranCelkem - s,
  };
}

/**
 * Celý projekt s víc herci: průměr herců. Každý herec čte svůj díl (nebo
 * svou roli), takže projekt je hotový, až když jsou hotoví všichni.
 */
export function progresProjektu(herci: ProgresNataceni[]): ProgresNataceni {
  const znami = herci.filter((h): h is NonNullable<ProgresNataceni> => h !== null);
  if (znami.length === 0) return null;
  if (znami.length === 1) return znami[0];
  if (znami.length === herci.length && znami.every((h) => h.dotoceno)) {
    return { procenta: 100, popis: 'Dotočeno', dotoceno: true, zbyva: 0 };
  }
  const procenta = Math.round(znami.reduce((a, h) => a + h.procenta, 0) / herci.length);
  const hotovych = znami.filter((h) => h.dotoceno).length;
  const herciText = `${herci.length} ${herci.length <= 4 ? 'herci' : 'herců'}`;
  return {
    procenta,
    popis: hotovych > 0 ? `${herciText}, dotočeno ${hotovych}` : herciText,
    dotoceno: false,
    zbyva: null,
  };
}
