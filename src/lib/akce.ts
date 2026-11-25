/**
 * FIREMNÍ AKCE - čistá část (zadání 25. 11. 2026).
 *
 * Bez Prismy, ať si soubor vezme formulář v prohlížeči i server - stejně jako
 * lib/tracklist.ts nebo lib/fakturaCast.ts.
 */

/**
 * ANKETA SI POŘADATEL SKLÁDÁ SÁM (zadání 25. 11. 2026: „chci ty anketní
 * otázky modifikovat a přidávat nové").
 *
 * Tři druhy otázek pokryjí všechno, co se u večírku ptáme:
 *   ANO_NE - ubytování, doprovod, parkování,
 *   VYBER  - co pijete, jaké jídlo (jedna nebo víc možností),
 *   TEXT   - vzkaz, alergie, cokoliv vlastními slovy.
 *
 * „Dorazíte?" mezi nimi NENÍ schválně: na tom stojí celý přehled (kdo přijde,
 * pro koho chystat postel) a je to první otázka každé pozvánky, takže ji
 * portál drží sám a nedá se smazat.
 */
export type TypOtazky = 'ANO_NE' | 'VYBER' | 'TEXT';

export type Otazka = {
  /** Krátký klíč; odpovědi se podle něj ukládají, takže se už nemění. */
  id: string;
  text: string;
  typ: TypOtazky;
  /** Jen u VYBER. */
  moznosti?: string[];
  /** Jen u VYBER: smí zaškrtnout víc najednou? */
  vicMoznosti?: boolean;
  /** Věta pod otázkou - proč se ptáme, co tam napsat. */
  napoveda?: string | null;
  /** Jen u ANO_NE: popisky tlačítek. Bez nich prosté „Ano" a „Ne". */
  ano?: string;
  ne?: string;
  /**
   * ZÁKLADNÍ OTÁZKA - „dorazíte?". Text i popisky tlačítek se u ní mění jako
   * u každé jiné (zadání 25. 11. 2026: „ty anketní otázky chci upravovat
   * všechny"), ale smazat ani přetypovat nejde: na její odpovědi stojí celý
   * přehled (kdo přijde, pro koho chystat postel) a zbytek ankety se ptá jen
   * těch, kdo dorazí.
   */
  zaklad?: boolean;
};

export const TYPY_OTAZEK: { typ: TypOtazky; nazev: string; popis: string }[] = [
  { typ: 'ANO_NE', nazev: 'Ano / ne', popis: 'Dvě tlačítka, odpověď se dá spočítat.' },
  { typ: 'VYBER', nazev: 'Výběr z možností', popis: 'Zaškrtávátka - dá se sečíst, kdo chce co.' },
  { typ: 'TEXT', nazev: 'Vlastní slova', popis: 'Volné pole - vzkaz, alergie, upřesnění.' },
];

/** Výchozí nabídka u otázky „Co pijete?" - dá se přepsat jako kterákoliv jiná. */
export const VYCHOZI_PITI = [
  'Bílé víno',
  'Červené víno',
  'Prosecco / sekt',
  'Pivo',
  'Tvrdý alkohol',
  'Nealko',
  'Káva / čaj',
];

/**
 * S čím začíná každá nová akce (zadání 25. 11. 2026: „dotazník, zda někdo
 * potřebuje ubytování nebo ne" + „a kdo co pije"). Pořadatel si to pak
 * upraví, smaže nebo přidá svoje.
 */
/** Klíč základní otázky. Odpověď na ni se ukládá do vlastního sloupce. */
export const KLIC_DORAZI = 'dorazi';

export const VYCHOZI_DORAZI: Otazka = {
  id: KLIC_DORAZI,
  text: 'Dorazíte?',
  typ: 'ANO_NE',
  ano: 'Dorazím',
  ne: 'Nedorazím',
  napoveda: null,
  zaklad: true,
};

export const VYCHOZI_OTAZKY: Otazka[] = [
  VYCHOZI_DORAZI,
  { id: 'ubytovani', text: 'Potřebujete přespat?', typ: 'ANO_NE', napoveda: null },
  {
    id: 'piti',
    text: 'Co pijete?',
    typ: 'VYBER',
    moznosti: VYCHOZI_PITI,
    vicMoznosti: true,
    napoveda: 'Klidně víc možností - ať víme, co nakoupit.',
  },
  {
    id: 'poznamka',
    text: 'Chcete nám ještě něco vzkázat?',
    typ: 'TEXT',
    napoveda: 'Jídlo, alergie, kdy dorazíte, s kým přijedete…',
  },
];

/** Klíč nové otázky. Náhodný, aby se dvě stejně pojmenované nepřekryly. */
export function novyKlicOtazky(): string {
  return `o${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Co přišlo z databáze nebo z formuláře, očištěné na tvar, se kterým se dá
 * pracovat. Neznámý typ, prázdný text ani chybějící id neprojdou - anketa se
 * kvůli jednomu pokaženému řádku nesmí rozsypat.
 */
export function ocistiOtazky(vstup: unknown): Otazka[] {
  if (!Array.isArray(vstup)) return [];
  const hotove: Otazka[] = [];
  const videna = new Set<string>();
  for (const polozka of vstup) {
    const o = (polozka ?? {}) as Record<string, unknown>;
    const id = String(o.id ?? '').trim().slice(0, 40);
    const text = String(o.text ?? '').trim().slice(0, 300);
    const typ = String(o.typ ?? '') as TypOtazky;
    if (!id || !text || videna.has(id)) continue;
    if (typ !== 'ANO_NE' && typ !== 'VYBER' && typ !== 'TEXT') continue;
    videna.add(id);
    const moznosti = Array.isArray(o.moznosti)
      ? (o.moznosti as unknown[])
          .map((m) => String(m ?? '').trim().slice(0, 120))
          .filter(Boolean)
          .slice(0, 30)
      : [];
    hotove.push({
      id,
      text,
      // Základní otázka je vždycky ano/ne - přetypovat ji nejde.
      typ: id === KLIC_DORAZI ? 'ANO_NE' : typ,
      ...(typ === 'VYBER' && id !== KLIC_DORAZI
        ? { moznosti, vicMoznosti: o.vicMoznosti !== false }
        : {}),
      ...(o.ano ? { ano: String(o.ano).trim().slice(0, 60) } : {}),
      ...(o.ne ? { ne: String(o.ne).trim().slice(0, 60) } : {}),
      ...(id === KLIC_DORAZI ? { zaklad: true } : {}),
      napoveda: o.napoveda ? String(o.napoveda).trim().slice(0, 300) : null,
    });
    if (hotove.length >= 30) break;
  }
  return hotove;
}

/**
 * Seznam otázek tak, jak se ptáme: základní „dorazíte?" vždycky první.
 * Když ji někdo z dat vyhodí (starší akce, ruční zásah), doplní se výchozí -
 * anketa bez ní nedává smysl.
 */
export function sOtazkouDorazi(otazky: Otazka[]): Otazka[] {
  const zaklad = otazky.find((o) => o.id === KLIC_DORAZI);
  const zbytek = otazky.filter((o) => o.id !== KLIC_DORAZI);
  return [{ ...VYCHOZI_DORAZI, ...(zaklad ?? {}), zaklad: true, typ: 'ANO_NE' }, ...zbytek];
}

/** Otázky, na které se ptáme až po „dorazím" - tedy všechny ostatní. */
export function otazkyPoDorazeni(otazky: Otazka[]): Otazka[] {
  return otazky.filter((o) => o.id !== KLIC_DORAZI);
}

/** Odpovědi na vlastní otázky: klíč otázky → odpověď podle jejího typu. */
export type Odpovedi = Record<string, boolean | string[] | string>;

/** Odpověď očištěná podle otázek - co k otázkám nepatří, se zahodí. */
export function ocistiOdpovedi(otazky: Otazka[], vstup: unknown): Odpovedi {
  const zdroj = (vstup ?? {}) as Record<string, unknown>;
  const hotove: Odpovedi = {};
  for (const o of otazky) {
    const hodnota = zdroj[o.id];
    if (hodnota === undefined || hodnota === null) continue;
    if (o.typ === 'ANO_NE') {
      if (typeof hodnota === 'boolean') hotove[o.id] = hodnota;
    } else if (o.typ === 'VYBER') {
      const nabidka = o.moznosti ?? [];
      const vybrane = Array.isArray(hodnota) ? hodnota.map((x) => String(x)) : [String(hodnota)];
      const ciste = nabidka.filter((m) => vybrane.includes(m));
      if (ciste.length > 0) hotove[o.id] = o.vicMoznosti === false ? [ciste[0]] : ciste;
    } else {
      const text = String(hodnota).trim().slice(0, 2000);
      if (text) hotove[o.id] = text;
    }
  }
  return hotove;
}

export type PozvankaPrehled = {
  id: string;
  jmeno: string;
  email: string;
  odeslanoAt: string | null;
  odpovedelAt: string | null;
  dorazi: boolean | null;
  odpovedi: Odpovedi;
};

/**
 * Člověk, kterého jde pozvat. Je to tu, a ne v akceServer.ts, aby si typ
 * mohla vzít i obrazovka v prohlížeči - ta nesmí sáhnout na soubor s Prismou.
 */
export type Kandidat = {
  id: string;
  jmeno: string;
  email: string;
  skupina: 'TYM' | 'HERCI' | 'KLIENTI';
  firma: string | null;
};

/**
 * Souhrn pro pořadatele: kolik lidí dorazí a jak dopadla každá otázka.
 * Počítá se jen z těch, kdo DORAZÍ - postel ani skleničku pro nepřítomného
 * nikdo nechystá.
 */
export function souhrnAkce(pozvanky: PozvankaPrehled[], otazky: Otazka[]) {
  const dorazi = pozvanky.filter((p) => p.dorazi === true);

  // „Dorazíte?" má vlastní počty nahoře, mezi ostatními otázkami by se jen
  // zdvojila.
  const podleOtazek = otazkyPoDorazeni(otazky).map((o) => {
    if (o.typ === 'ANO_NE') {
      const ano = dorazi.filter((p) => p.odpovedi[o.id] === true).length;
      const ne = dorazi.filter((p) => p.odpovedi[o.id] === false).length;
      return { otazka: o, ano, ne, moznosti: [] as { nazev: string; pocet: number }[], texty: [] as { jmeno: string; text: string }[] };
    }
    if (o.typ === 'VYBER') {
      const pocty = new Map<string, number>();
      for (const p of dorazi) {
        const hodnota = p.odpovedi[o.id];
        if (!Array.isArray(hodnota)) continue;
        for (const m of hodnota) pocty.set(m, (pocty.get(m) ?? 0) + 1);
      }
      return {
        otazka: o,
        ano: 0,
        ne: 0,
        moznosti: (o.moznosti ?? [])
          .map((m) => ({ nazev: m, pocet: pocty.get(m) ?? 0 }))
          .filter((m) => m.pocet > 0),
        texty: [] as { jmeno: string; text: string }[],
      };
    }
    return {
      otazka: o,
      ano: 0,
      ne: 0,
      moznosti: [] as { nazev: string; pocet: number }[],
      texty: dorazi
        .map((p) => ({ jmeno: p.jmeno, text: typeof p.odpovedi[o.id] === 'string' ? (p.odpovedi[o.id] as string) : '' }))
        .filter((t) => t.text),
    };
  });

  return {
    pozvano: pozvanky.length,
    odeslano: pozvanky.filter((p) => p.odeslanoAt).length,
    odpovedelo: pozvanky.filter((p) => p.odpovedelAt).length,
    dorazi: dorazi.length,
    nedorazi: pozvanky.filter((p) => p.dorazi === false).length,
    otazky: podleOtazek,
  };
}

/** Odpověď jednoho člověka do jedné věty - do seznamu pozvaných. */
export function popisOdpovedi(otazky: Otazka[], odpovedi: Odpovedi): string {
  const kousky: string[] = [];
  for (const o of otazkyPoDorazeni(otazky)) {
    const hodnota = odpovedi[o.id];
    if (hodnota === undefined) continue;
    if (o.typ === 'ANO_NE') kousky.push(`${o.text} ${hodnota ? (o.ano ?? 'ano') : (o.ne ?? 'ne')}`);
    else if (Array.isArray(hodnota)) kousky.push(hodnota.join(', '));
    else kousky.push(String(hodnota));
  }
  return kousky.join(' · ');
}
