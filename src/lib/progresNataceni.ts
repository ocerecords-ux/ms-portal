/**
 * PROGRES NATÁČENÍ (zadání 19. 9. 2026) - společný tvar pro herce, klienta
 * i detail projektu. Soubor je bez databáze, používá ho i prohlížeč.
 *
 * Počítá se ze STRAN: poslední zapsaná strana („kde jsme skončili") proti
 * počtu stran PDF s textem. Tlačítko Dotočeno znamená 100 %.
 */
export type ProgresNataceni = {
  procenta: number;
  /** „str. 142 z 380", „str. 141" nebo „Dotočeno". */
  popis: string;
  dotoceno: boolean;
  /**
   * NEVÍME, KOLIK STRAN TEXT MÁ (oprava 29. 9. 2026: „my ty strany normálně
   * u sebe vidíme. Tak proč to nevidí klient?").
   *
   * Interně svítí u herce odznak s poslední natočenou stranou - ten žádný
   * celek nepotřebuje. Klientovi se kreslí válec s procenty, a ten se bez
   * počtu stran PDF spočítat nedá, takže mu do teď zůstávala prázdná buňka,
   * i když jsme tu stranu dávno znali.
   *
   * S tímhle příznakem se strana ukáže i bez celku - jen jako text, bez
   * válce a bez procent. Vymyšlené procento by bylo horší než žádné.
   */
  neznamyCelek: boolean;
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
  if (dotoceno) return { procenta: 100, popis: 'Dotočeno', dotoceno: true, zbyva: 0, neznamyCelek: false };
  if (!stranCelkem || stranCelkem <= 0) {
    // Text ve složce není, ale zápis strany máme - viz `neznamyCelek` výše.
    if (!strana || strana <= 0) return null;
    return { procenta: 0, popis: `str. ${strana}`, dotoceno: false, zbyva: null, neznamyCelek: true };
  }
  const s = Math.max(0, Math.min(strana ?? 0, stranCelkem));
  return {
    procenta: Math.round((s / stranCelkem) * 100),
    popis: `str. ${s} z ${stranCelkem}`,
    dotoceno: false,
    zbyva: stranCelkem - s,
    neznamyCelek: false,
  };
}

/**
 * Celý projekt s víc herci: průměr herců. Každý herec čte svůj díl (nebo
 * svou roli), takže projekt je hotový, až když jsou hotoví všichni.
 */
export function progresProjektu(herci: ProgresNataceni[]): ProgresNataceni {
  const vsichni = herci.filter((h): h is NonNullable<ProgresNataceni> => h !== null);
  if (vsichni.length === 0) return null;
  if (vsichni.length === 1) return vsichni[0];

  // Do průměru jdou jen herci, u kterých procento něco znamená. Kdo má jen
  // stranu bez celku, se do něj počítat nedá - přispěl by nulou a projekt by
  // vypadal zpožděněji, než je.
  const znami = vsichni.filter((h) => !h.neznamyCelek);
  const herciText = `${herci.length} ${herci.length <= 4 ? 'herci' : 'herců'}`;
  if (znami.length === 0) {
    return { procenta: 0, popis: herciText, dotoceno: false, zbyva: null, neznamyCelek: true };
  }
  if (znami.length === herci.length && znami.every((h) => h.dotoceno)) {
    return { procenta: 100, popis: 'Dotočeno', dotoceno: true, zbyva: 0, neznamyCelek: false };
  }
  const procenta = Math.round(znami.reduce((a, h) => a + h.procenta, 0) / znami.length);
  const hotovych = znami.filter((h) => h.dotoceno).length;
  return {
    procenta,
    popis: hotovych > 0 ? `${herciText}, dotočeno ${hotovych}` : herciText,
    dotoceno: false,
    zbyva: null,
    neznamyCelek: false,
  };
}
