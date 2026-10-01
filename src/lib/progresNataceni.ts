/**
 * PROGRES NATÁČENÍ (zadání 19. 9. 2026) - společný tvar pro herce, klienta
 * i detail projektu. Soubor je bez databáze, používá ho i prohlížeč.
 *
 * Počítá se ze STRAN: poslední zapsaná strana („kde jsme skončili") proti
 * počtu stran PDF s textem. Tlačítko Dotočeno znamená 100 %.
 *
 * JAK SE KNIHA DĚLÍ MEZI HERCE (upřesněno 1. 10. 2026 po dvou špatných
 * pokusech): „ten počet NS u každého herce je celkový počet NS, které mají
 * za celou knihu natočit, a mají to v různých částech knihy… může se stát,
 * že herečka čte kapitolu 1, 3, 7 a herec kapitolu 2, 4, 5 a 6. Ten počet NS
 * u každého herce slouží jen jako poměr a údaj pro to, kolik máme kterému
 * naplánovat frekvencí."
 *
 * Z toho plyne všechno podstatné:
 *
 *  - Herec NEMÁ souvislý úsek knihy. Jeho kapitoly jsou rozházené po celém
 *    textu, takže „od strany - do strany" u něj neexistuje. Dřívější dělení
 *    textu na díly bylo postavené na hlavu: Tomáš se zapsanou stranou 222
 *    dostal díl 325-670 a vyšla mu nula, i když točil.
 *  - Oba herci se textem pohybují od začátku do konce SPOLEČNĚ. Kdo je na
 *    straně 222 z 670, má za sebou zhruba třetinu SVÝCH kapitol - proto se
 *    jeho procento počítá prostě proti celému textu.
 *  - Normostrany herce jsou VÁHA, ne pozice. Projekt je vážený součet: kdo
 *    má natočit dvě třetiny normostran, váží na výsledku dvě třetiny.
 *
 * Je to odhad, ne zápis: předpokládá, že kapitoly herce jsou po knize
 * rozložené rovnoměrně. Přesné by to bylo až ze seznamu kapitol s tím, kdo
 * kterou čte - do té doby je tohle nejbližší pravdě, co z našich čísel jde.
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
   * Kolik STRAN TEXTU zbývá projít (zadání 19. 9. 2026: „info o tom, kolik
   * stran zbývá dotočit"). Null u souhrnu víc herců.
   */
  zbyva: number | null;
  /**
   * Kolik NORMOSTRAN tomuhle herci zbývá natočit (1. 10. 2026). Tohle je
   * číslo, ze kterého se plánují frekvence - strany textu k tomu neřeknou
   * nic, protože herec čte jen své kapitoly. Null, když u herce rozsah není.
   */
  zbyvaNs: number | null;
  /**
   * CELKOVÝ ROZSAH HERCE V NORMOSTRANÁCH - jeho váha v projektu. Null, když
   * u něj rozsah zadaný není.
   *
   * Schválně zvlášť od `rozsah`/`hotovo`: vážit se smí jen tehdy, když mají
   * normostrany VŠICHNI. Míchat 169 normostran jednoho herce s 670 stranami
   * druhého by dalo nesmysl.
   */
  vahaNs: number | null;
  /**
   * Odpracovaná část a celek - v normostranách, když je známe, jinak ve
   * stranách textu. Slouží k výpisu („z jeho 169"), ne k vážení.
   */
  rozsah: number | null;
  hotovo: number | null;
};

/** „1 strana", „3 strany", „12 stran". */
export function stranText(n: number): string {
  return `${n} ${n === 1 ? 'strana' : n >= 2 && n <= 4 ? 'strany' : 'stran'}`;
}

/**
 * KOEFICIENT PŘEVODU U JEDNÉ KNIHY (zadání 30. 9. 2026: „musíme u každé
 * knihy spočítat koeficient převodu z pdf na normostrany" + „každá kniha ale
 * bude mít jiný koeficient, musíme to vždycky přepočítat").
 *
 * Kolik normostran připadá na jednu stranu textu - záleží na sazbě, takže je
 * u každé knihy jiný. Nikde se neukládá: počítá se při každém zobrazení ze
 * dvou čísel toho projektu, takže se sám opraví, jakmile se vymění PDF nebo
 * upraví rozsah.
 *
 * K čemu je: převádí „zbývá projít 448 stran textu" na „zbývá natočit 220
 * normostran", a to je jednotka, ve které se plánují frekvence.
 */
export type KoeficientKnihy = {
  /** Normostran na jednu stranu textu. 328 NS / 670 stran = 0,49. */
  nsNaStranu: number;
  stranPdf: number;
  normostrany: number;
};

export function koeficientKnihy(
  stranPdf: number | null,
  normostrany: number | null,
): KoeficientKnihy | null {
  if (!stranPdf || stranPdf <= 0) return null;
  if (!normostrany || normostrany <= 0) return null;
  return { nsNaStranu: normostrany / stranPdf, stranPdf, normostrany };
}

/**
 * Progres jednoho herce (nebo projektu s jediným hercem).
 *
 * `normostranyHerce` je jeho CELKOVÝ rozsah za celou knihu - váha, ne pozice.
 * Když ho známe, počítá se z něj, kolik normostran má hotových a kolik mu
 * zbývá; bez něj se pracuje jen se stranami textu.
 */
export function progresZeStran(
  strana: number | null,
  stranCelkem: number | null,
  dotoceno: boolean,
  normostranyHerce?: number | null,
): ProgresNataceni {
  const ns = normostranyHerce && normostranyHerce > 0 ? normostranyHerce : null;

  if (dotoceno) {
    const vaha = ns ?? stranCelkem ?? null;
    return {
      procenta: 100,
      popis: 'Dotočeno',
      dotoceno: true,
      zbyva: 0,
      zbyvaNs: ns ? 0 : null,
      neznamyCelek: false,
      vahaNs: ns,
      rozsah: vaha,
      hotovo: vaha,
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
      zbyvaNs: null,
      neznamyCelek: true,
      vahaNs: ns,
      rozsah: null,
      hotovo: null,
    };
  }

  const s = Math.max(0, Math.min(strana ?? 0, stranCelkem));
  const podil = s / stranCelkem;
  // Hotovo a zbývá v normostranách: herec má svůj rozsah rozprostřený po celé
  // knize, takže co prošel z textu, to prošel i ze svých kapitol.
  const hotovoNs = ns ? Math.round(ns * podil) : null;
  return {
    procenta: Math.round(podil * 100),
    popis: `str. ${s} z ${stranCelkem}`,
    dotoceno: false,
    zbyva: stranCelkem - s,
    zbyvaNs: ns && hotovoNs !== null ? Math.max(0, ns - hotovoNs) : null,
    neznamyCelek: false,
    vahaNs: ns,
    rozsah: ns ?? stranCelkem,
    hotovo: hotovoNs ?? s,
  };
}

/**
 * Celý projekt s víc herci. Každý má natočit svůj počet normostran, takže
 * projekt je VÁŽENÝ součet: kdo má dvě třetiny normostran, váží na výsledku
 * dvě třetiny. Prostý průměr by u knihy dělené 20/80 tvrdil, že je hotová
 * z poloviny, i když se natočil jen ten kratší díl.
 */
export function progresProjektu(herci: ProgresNataceni[]): ProgresNataceni {
  const vsichni = herci.filter((h): h is NonNullable<ProgresNataceni> => h !== null);
  if (vsichni.length === 0) return null;
  if (vsichni.length === 1) return vsichni[0];

  // Do součtu jdou jen herci, u kterých procento něco znamená. Kdo má jen
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
      zbyvaNs: null,
      neznamyCelek: true,
      vahaNs: null,
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
      zbyvaNs: 0,
      neznamyCelek: false,
      vahaNs: null,
      rozsah: null,
      hotovo: null,
    };
  }

  /**
   * VÁŽÍ SE JEN TEHDY, KDYŽ MAJÍ NORMOSTRANY VŠICHNI. Kdyby jeden herec
   * rozsah neměl, vážilo by se jeho 670 stran textu proti 169 normostranám
   * druhého a vyšel by nesmysl. Bez kompletních vah je poctivější průměr -
   * a karta vedle toho napíše, komu rozsah chybí.
   */
  const svahou = znami.filter((h) => h.vahaNs !== null && h.vahaNs > 0);
  const vazene = svahou.length === znami.length && svahou.length > 0;
  const rozsahCelkem = vazene ? svahou.reduce((a, h) => a + (h.vahaNs ?? 0), 0) : 0;
  const hotovoCelkem = vazene
    ? svahou.reduce((a, h) => a + (h.vahaNs ?? 0) * (h.procenta / 100), 0)
    : 0;

  const procenta =
    vazene && rozsahCelkem > 0
      ? Math.round((hotovoCelkem / rozsahCelkem) * 100)
      : Math.round(znami.reduce((a, h) => a + h.procenta, 0) / znami.length);
  const hotovych = znami.filter((h) => h.dotoceno).length;
  const zbyvaNs = znami.every((h) => h.zbyvaNs !== null)
    ? znami.reduce((a, h) => a + (h.zbyvaNs ?? 0), 0)
    : null;
  return {
    procenta,
    popis: hotovych > 0 ? `${herciText}, dotočeno ${hotovych}` : herciText,
    dotoceno: false,
    zbyva: null,
    zbyvaNs,
    neznamyCelek: false,
    vahaNs: vazene && rozsahCelkem > 0 ? rozsahCelkem : null,
    rozsah: vazene && rozsahCelkem > 0 ? rozsahCelkem : null,
    hotovo: vazene && rozsahCelkem > 0 ? Math.round(hotovoCelkem) : null,
  };
}
