/**
 * PROGRES NATÁČENÍ (zadání 19. 9. 2026) - společný tvar pro herce, klienta
 * i detail projektu. Soubor je bez databáze, používá ho i prohlížeč.
 *
 * Počítá se ze STRAN: poslední zapsaná strana („kde jsme skončili") proti
 * počtu stran PDF s textem. Tlačítko Dotočeno znamená 100 %.
 *
 * DVĚ JEDNOTKY, KTERÉ SE PŘEPOČÍTÁVAJÍ (zadání 30. 9. 2026: „máme tam dvě
 * jednotky, jak počítáme stránky, ale to bych zachoval, jen bych to
 * přepočítával mezi sebou"):
 *
 *  1. STRANY PDF - zapisuje zvukař po natáčení, ať víme, na které straně
 *     jsme. PDF není formátované na normostrany, takže je to jiné číslo.
 *  2. NORMOSTRANY - z nich se počítá odhad frekvencí a cena a každý herec
 *     má u sebe napsaný svůj rozsah.
 *
 * KDYŽ KNIHU ČTE VÍC HERCŮ, ČTE JI KAŽDÝ OD JINUD (zadání 30. 9. 2026:
 * „potřeboval bych nějak zohlednit to, že když první herec začíná na první
 * straně a ten druhý má až druhou půlku knihy, aby to nepočítalo, že je
 * progres vyšší, než je").
 *
 * Do teď se strana každého herce dělila CELÝM počtem stran PDF. Druhý herec
 * na straně 400 z 500 tím vyšel na 80 %, i když ze svého dílu (251-500) má
 * teprve necelých 60 - a první herec, který svou půlku dočetl na straně 250,
 * ukazoval 50 % místo hotova. Průměr obou pak lhal na obě strany.
 *
 * Teď se normostrany herců přepočítají na strany PDF (poměrem rozsahů) a
 * z toho vyjde DÍL každého herce - od které do které strany PDF čte. Procento
 * se počítá uvnitř toho dílu a projekt je vážený součet dílů, ne průměr:
 * herec s třetinou knihy má na výsledku třetinový podíl.
 *
 * Je to ODHAD, ne zápis: dělení podle normostran sedí jen když se kniha
 * dělila po sobě (první herec začátek, druhý konec), což je náš případ.
 * Proto se díly počítají jen tam, kde má rozsah vyplněný KAŽDÝ herec -
 * jinak se pracuje po staru s celým textem.
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
  /**
   * Kolik stran má díl, proti kterému se počítá, a kolik z nich je hotových
   * (30. 9. 2026). Podle toho se projekt skládá VÁŽENĚ - herec s třetinou
   * knihy má na výsledku třetinový podíl. Null = neznámý celek.
   */
  rozsah: number | null;
  hotovo: number | null;
} | null;

/** „1 strana", „3 strany", „12 stran". */
export function stranText(n: number): string {
  return `${n} ${n === 1 ? 'strana' : n >= 2 && n <= 4 ? 'strany' : 'stran'}`;
}

/** Díl herce ve stranách PDF - od které do které čte, obojí včetně. */
export type DilHerce = { od: number; do: number };

export function progresZeStran(
  strana: number | null,
  stranCelkem: number | null,
  dotoceno: boolean,
  /** Díl herce (30. 9. 2026). Bez něj se počítá proti celému textu jako dřív. */
  dil?: DilHerce | null,
): ProgresNataceni {
  if (dotoceno) {
    const cely = dil ? dil.do - dil.od + 1 : (stranCelkem ?? null);
    return {
      procenta: 100,
      popis: 'Dotočeno',
      dotoceno: true,
      zbyva: 0,
      neznamyCelek: false,
      rozsah: cely,
      hotovo: cely,
    };
  }

  if (dil && dil.do >= dil.od) {
    const rozsah = dil.do - dil.od + 1;
    // Strana před začátkem dílu = herec ještě nezačal; za koncem = má hotovo.
    const hotovo = Math.max(0, Math.min((strana ?? 0) - dil.od + 1, rozsah));
    return {
      procenta: Math.round((hotovo / rozsah) * 100),
      // „str. 400 · díl 251-500" - číslo z PDF zůstává, ať se dá porovnat
      // se zápisem zvukaře, a vedle je vidět, z čeho se počítá.
      popis: strana ? `str. ${strana} · díl ${dil.od}–${dil.do}` : `díl ${dil.od}–${dil.do}`,
      dotoceno: false,
      zbyva: rozsah - hotovo,
      neznamyCelek: false,
      rozsah,
      hotovo,
    };
  }

  if (!stranCelkem || stranCelkem <= 0) {
    // Text ve složce není, ale zápis strany máme - viz `neznamyCelek` výše.
    if (!strana || strana <= 0) return null;
    return {
      procenta: 0,
      popis: `str. ${strana}`,
      dotoceno: false,
      zbyva: null,
      neznamyCelek: true,
      rozsah: null,
      hotovo: null,
    };
  }
  const s = Math.max(0, Math.min(strana ?? 0, stranCelkem));
  return {
    procenta: Math.round((s / stranCelkem) * 100),
    popis: `str. ${s} z ${stranCelkem}`,
    dotoceno: false,
    zbyva: stranCelkem - s,
    neznamyCelek: false,
    rozsah: stranCelkem,
    hotovo: s,
  };
}

/**
 * ROZDĚLENÍ TEXTU MEZI HERCE (30. 9. 2026). Z normostran každého herce se
 * poměrem udělá jeho díl ve stranách PDF - herci jdou po sobě v pořadí, ve
 * kterém dostali seznam, a díly na sebe navazují bez mezery.
 *
 * Poslední herec dostane zbytek do konce, ať se zaokrouhlováním neztratí
 * strana a poslední díl vždycky končí na poslední straně textu.
 *
 * Vrátí prázdno, když rozdělovat nemá co: jeden herec, chybějící rozsah
 * u kohokoliv, nebo neznámý počet stran PDF. Tam platí starý výpočet proti
 * celému textu.
 */
export function rozdelStrany(
  podily: { klic: string; normostrany: number }[],
  stranCelkem: number | null,
): Record<string, DilHerce> {
  if (!stranCelkem || stranCelkem <= 0) return {};
  if (podily.length < 2) return {};
  if (podily.some((p) => !p.normostrany || p.normostrany <= 0)) return {};

  const celkemNs = podily.reduce((a, p) => a + p.normostrany, 0);
  if (celkemNs <= 0) return {};

  const dily: Record<string, DilHerce> = {};
  let od = 1;
  podily.forEach((p, i) => {
    const posledni = i === podily.length - 1;
    const doStrany = posledni
      ? stranCelkem
      : Math.min(stranCelkem, od + Math.max(1, Math.round((p.normostrany / celkemNs) * stranCelkem)) - 1);
    dily[p.klic] = { od, do: Math.max(od, doStrany) };
    od = dily[p.klic].do + 1;
  });
  return dily;
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
    return {
      procenta: 0,
      popis: herciText,
      dotoceno: false,
      zbyva: null,
      neznamyCelek: true,
      rozsah: null,
      hotovo: null,
    };
  }
  if (znami.length === herci.length && znami.every((h) => h.dotoceno)) {
    return {
      procenta: 100,
      popis: 'Dotočeno',
      dotoceno: true,
      zbyva: 0,
      neznamyCelek: false,
      rozsah: null,
      hotovo: null,
    };
  }
  /**
   * VÁŽENĚ, NE PRŮMĚREM (30. 9. 2026). Kdo čte třetinu knihy, má na výsledku
   * třetinový podíl - prostý průměr dvou herců by u knihy dělené 20/80 tvrdil,
   * že je hotová z poloviny, i když se natočil jen ten kratší díl.
   *
   * Průměr zůstává jako záloha pro případ, že u někoho rozsah neznáme.
   */
  const sRozsahem = znami.filter((h) => h.rozsah !== null && h.hotovo !== null);
  const vazene = sRozsahem.length === znami.length && sRozsahem.length > 0;
  const rozsahCelkem = vazene ? sRozsahem.reduce((a, h) => a + (h.rozsah ?? 0), 0) : 0;
  const hotovoCelkem = vazene ? sRozsahem.reduce((a, h) => a + (h.hotovo ?? 0), 0) : 0;

  const procenta =
    vazene && rozsahCelkem > 0
      ? Math.round((hotovoCelkem / rozsahCelkem) * 100)
      : Math.round(znami.reduce((a, h) => a + h.procenta, 0) / znami.length);
  const hotovych = znami.filter((h) => h.dotoceno).length;
  return {
    procenta,
    popis: hotovych > 0 ? `${herciText}, dotočeno ${hotovych}` : herciText,
    dotoceno: false,
    zbyva: null,
    neznamyCelek: false,
    rozsah: vazene && rozsahCelkem > 0 ? rozsahCelkem : null,
    hotovo: vazene && rozsahCelkem > 0 ? hotovoCelkem : null,
  };
}
