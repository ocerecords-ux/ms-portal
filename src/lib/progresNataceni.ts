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
 * KOEFICIENT PŘEVODU U KAŽDÉ KNIHY ZVLÁŠŤ (zadání 30. 9. 2026: „musíme
 * u každé knihy spočítat koeficient převodu z pdf na normostrany. U každého
 * herce jsou pak jasné poměry. Ten poměr je jasně daný z NS" - a vzápětí:
 * „každá kniha ale bude mít jiný koeficient, musíme to vždycky přepočítat").
 *
 * Koeficient je `strany PDF ÷ normostrany knihy` a je to číslo TÉ JEDNÉ
 * KNIHY - jak hustě je vysázená. Nikde se neukládá a nikde se nesdílí mezi
 * projekty: pokaždé se spočítá ze dvou čísel toho projektu, takže se sám
 * opraví, jakmile se vymění PDF nebo upraví rozsah.
 *
 * Díl herce pak vyjde z JEHO normostran krát koeficient - ne z půlení textu.
 * Procento se počítá uvnitř dílu a projekt je vážený součet dílů, ne průměr:
 * herec s třetinou knihy má na výsledku třetinový podíl.
 *
 * CO SE NEDOMÝŠLÍ. Dělení podle normostran platí jen tehdy, když se kniha
 * dělila po sobě (první herec začátek, druhý konec) a když má rozsah
 * vyplněný KAŽDÝ herec. Chybí-li komukoliv, žádný díl se nevymyslí a počítá
 * se po staru proti celému textu - vymyšlená hranice je horší než žádná.
 * A když herci vyjde díl, do kterého se jeho zapsaná strana vůbec nevejde,
 * je to rozpor v datech a musí být vidět (`mimoDil`), ne utnutý na nulu.
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
  /**
   * ZAPSANÁ STRANA LEŽÍ MIMO DÍL, KTERÝ NA HERCE VYŠEL (30. 9. 2026).
   *
   * Stalo se to Tomáši Žilinskému: měl zapsanou stranu 222, ale z normostran
   * mu vyšel díl 325-670. Výpočet ho utnul na nulu, takže karta tvrdila 0 %
   * a „zbývá 346 stran" u herce, který evidentně někde na 222 točil.
   *
   * Tichá nula je tady horší než přiznaný rozpor: buď jsou špatně zadané
   * normostrany, nebo se kniha nedělila po sobě. Obojí je práce pro člověka,
   * ne pro dopočet.
   */
  mimoDil: boolean;
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
      mimoDil: false,
    };
  }

  if (dil && dil.do >= dil.od) {
    const rozsah = dil.do - dil.od + 1;
    // Strana před začátkem dílu = herec ještě nezačal; za koncem = má hotovo.
    const hotovo = Math.max(0, Math.min((strana ?? 0) - dil.od + 1, rozsah));
    // Zápis PŘED začátkem dílu není „ještě nezačal" - je to rozpor. Kdo
    // nezačal, nemá zapsanou žádnou stranu.
    const mimoDil = Boolean(strana && strana > 0 && strana < dil.od);
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
      mimoDil,
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
      mimoDil: false,
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
    mimoDil: false,
  };
}

/**
 * KOEFICIENT PŘEVODU U JEDNÉ KNIHY: kolik stran PDF připadá na normostranu.
 *
 * Každá kniha má svůj (zadání 30. 9. 2026: „každá kniha ale bude mít jiný
 * koeficient, musíme to vždycky přepočítat"), protože záleží na sazbě -
 * velikosti písma, prokladu, okrajích. Proto se nikde neukládá: spočítá se
 * při každém zobrazení ze dvou čísel toho projektu.
 */
export type KoeficientKnihy = {
  /** Strany PDF na jednu normostranu. 670 stran / 328 NS = 2,043. */
  stranNaNs: number;
  stranPdf: number;
  normostrany: number;
};

export function koeficientKnihy(
  stranPdf: number | null,
  normostrany: number | null,
): KoeficientKnihy | null {
  if (!stranPdf || stranPdf <= 0) return null;
  if (!normostrany || normostrany <= 0) return null;
  return { stranNaNs: stranPdf / normostrany, stranPdf, normostrany };
}

export type RozdeleniTextu = {
  dily: Record<string, DilHerce>;
  koeficient: KoeficientKnihy | null;
  /** Klíče herců bez vyplněného rozsahu - kvůli nim se díly nepočítají. */
  bezNormostran: string[];
  /**
   * Součet normostran herců se rozchází s rozsahem knihy. Není to důvod
   * nepočítat - je to důvod to napsat, protože jedno z těch čísel je špatně.
   */
  nesoulad: { soucetHercu: number; kniha: number } | null;
};

/**
 * ROZDĚLENÍ TEXTU MEZI HERCE (30. 9. 2026). Díl každého herce vyjde z JEHO
 * normostran krát koeficient knihy - ne z půlení textu. Herci jdou po sobě
 * v pořadí, ve kterém čtou, a díly na sebe navazují bez mezery.
 *
 * Poslední herec dostane zbytek do konce, ať se zaokrouhlováním neztratí
 * strana a poslední díl vždycky končí na poslední straně textu. Bez toho by
 * u knihy, kde se čísla o kousek rozcházejí, nešlo dojet na 100 %.
 *
 * Když koeficient neznáme (chybí rozsah knihy v normostranách), použije se
 * poměr normostran herců mezi sebou - vyjde totéž, kdykoliv jejich součet
 * rozsahu knihy odpovídá.
 *
 * Díly zůstanou prázdné, když rozdělovat nemá co: jeden herec, chybějící
 * rozsah u kohokoliv, nebo neznámý počet stran PDF. Tam platí starý výpočet
 * proti celému textu.
 */
export function rozdelPodleNormostran(
  podily: { klic: string; normostrany: number }[],
  stranPdf: number | null,
  normostranyKnihy: number | null,
): RozdeleniTextu {
  const koeficient = koeficientKnihy(stranPdf, normostranyKnihy);
  const bezNormostran = podily.filter((p) => !p.normostrany || p.normostrany <= 0).map((p) => p.klic);
  const soucetHercu = podily.reduce((a, p) => a + (p.normostrany > 0 ? p.normostrany : 0), 0);
  const nesoulad =
    normostranyKnihy && normostranyKnihy > 0 && soucetHercu > 0 && Math.abs(soucetHercu - normostranyKnihy) > 1
      ? { soucetHercu, kniha: normostranyKnihy }
      : null;

  const prazdno: RozdeleniTextu = { dily: {}, koeficient, bezNormostran, nesoulad };
  if (!stranPdf || stranPdf <= 0) return prazdno;
  if (podily.length < 2) return prazdno;
  if (bezNormostran.length > 0) return prazdno;
  if (soucetHercu <= 0) return prazdno;

  const dily: Record<string, DilHerce> = {};
  let od = 1;
  podily.forEach((p, i) => {
    const posledni = i === podily.length - 1;
    // Délka dílu z koeficientu; bez něj z poměru normostran mezi herci.
    const delka = koeficient
      ? Math.round(p.normostrany * koeficient.stranNaNs)
      : Math.round((p.normostrany / soucetHercu) * stranPdf);
    const doStrany = posledni ? stranPdf : Math.min(stranPdf, od + Math.max(1, delka) - 1);
    dily[p.klic] = { od, do: Math.max(od, doStrany) };
    od = dily[p.klic].do + 1;
  });
  return { dily, koeficient, bezNormostran, nesoulad };
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
      mimoDil: false,
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
      mimoDil: false,
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
    // Souhrn projektu nemá vlastní díl; rozpor se hlásí u herce, kterého se
    // týká, ale ať je vidět i nahoře, že se v číslech někde nesejdeme.
    mimoDil: znami.some((h) => h.mimoDil),
  };
}
