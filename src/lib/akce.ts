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

/**
 * ČAS Z FORMULÁŘE JE ČAS V PRAZE (oprava 25. 11. 2026: „mám vyplněno 10:00
 * a v pozvánce došlo 20:00").
 *
 * `<input type="datetime-local">` posílá „2026-12-19T10:00" bez pásma a
 * `new Date(...)` si ho přečte v pásmu STROJE - na Vercelu je to UTC, takže
 * z desáté dopoledne byla jedenáctá. A protože se políčko při dalším otevření
 * vyplnilo zpátky už tím posunutým časem, každé další uložení přidalo další
 * hodinu; po pár úpravách z toho bylo 20:00.
 *
 * Řetězec se proto skládá jako UTC a odečte se posun Prahy v ten okamžik.
 * Dvakrát schválně: u času v noci na přechod letního času vyjde posun
 * napoprvé z „opačné" strany a druhý průchod to srovná.
 */
function posunPrahy(okamzik: Date): number {
  const casti = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Prague',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(okamzik);
  const kus = (typ: string) => Number(casti.find((c) => c.type === typ)?.value ?? '0');
  const jakoUtc = Date.UTC(
    kus('year'),
    kus('month') - 1,
    kus('day'),
    kus('hour') % 24,
    kus('minute'),
    kus('second'),
  );
  return jakoUtc - okamzik.getTime();
}

/** „2026-12-19T10:00" nebo „2026-12-19" v čase Prahy → skutečný okamžik. */
export function datumZPrahy(hodnota: string | null | undefined): Date | null {
  if (!hodnota) return null;
  const shoda = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(hodnota.trim());
  if (!shoda) return null;
  const zakladUtc = Date.UTC(
    Number(shoda[1]),
    Number(shoda[2]) - 1,
    Number(shoda[3]),
    Number(shoda[4] ?? '0'),
    Number(shoda[5] ?? '0'),
  );
  if (Number.isNaN(zakladUtc)) return null;
  const prvni = zakladUtc - posunPrahy(new Date(zakladUtc));
  const druhy = zakladUtc - posunPrahy(new Date(prvni));
  return new Date(druhy);
}

/**
 * ODKAZ S MAPKOU (zadání 25. 11. 2026: „rovnou odkaz s mapkou").
 *
 * Když pořadatel vloží vlastní odkaz (konkrétní špendlík v mapě, stránka
 * podniku), použije se ten. Jinak se z místa poskládá hledání na Mapách
 * Google - to otevře kdokoliv, na mobilu i v prohlížeči, bez účtu a bez
 * aplikace. Prázdné místo = žádné tlačítko, ať mail neposílá lidi hledat
 * „null". Stejné pravidlo jako u pozvánek hostům na natáčení
 * (lib/hosteNataceni.ts); tady zvlášť, protože tenhle soubor čte i prohlížeč
 * a serverová knihovna by se do něj netáhla.
 */
export function odkazNaMapu(misto: string | null | undefined, mapa?: string | null): string | null {
  const vlastni = (mapa ?? '').trim();
  if (/^https?:\/\//i.test(vlastni)) return vlastni;
  const kde = (misto ?? '').trim();
  if (!kde) return null;
  // Místo samo může být odkaz - pak se nehledá, jde se na něj.
  if (/^https?:\/\//i.test(kde)) return kde;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(kde)}`;
}

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

/* ------------------------------------------------------------------ *
 * NÁKUP A PLÁNOVAČ JÍDLA (zadání 26. 11. 2026: „chci už průběžný přehled
 * v tabulce, kolik kdo čeho bude pít, kdo potřebuje hotel, a odhad kolik toho
 * nakoupit. Pak bych přidal ještě plánovač jídla - napíšu položku, třeba
 * šunka, a vedle mi to udělá odhad, kolik toho koupit celkem").
 *
 * JEDNA TABULKA NA PITÍ I JÍDLO. Obojí je totéž počítání: dávka na osobu krát
 * počet lidí. Liší se jen to, pro koho se počítá - šunka pro všechny, pivo
 * jen pro ty, kdo pivo zaškrtli. Proto má položka `proKoho`: buď všichni, kdo
 * dorazí, nebo konkrétní odpověď z ankety.
 *
 * DVĚ ČÍSLA, NE JEDNO (volba 26. 11. 2026): JISTÉ podle potvrzených
 * a STROP, kdyby dorazili i ti, co ještě mlčí. U otázek se mlčící rozpočítají
 * v poměru, v jakém odpověděli ostatní - víc se z toho vyčíst nedá a nula by
 * lhala stejně jako plný počet.
 * ------------------------------------------------------------------ */

/** Pro koho se položka počítá: všichni, kdo dorazí. */
export const PRO_VSECHNY = 'vsichni';
/** Oddělovač v klíči cíle: „<id otázky>::<odpověď>". */
const DELIC_CILE = '::';

export type PolozkaNakupu = {
  id: string;
  nazev: string;
  /** Dávka na jednoho člověka - 4 (piva), 0.08 (kg šunky). */
  naOsobu: number;
  /** Jednotka, jak ji pořadatel napíše: ks, kg, l, plátky. */
  jednotka: string;
  /** PRO_VSECHNY, nebo „<id otázky>::<ano|ne|název možnosti>". */
  proKoho: string;
  /**
   * Dávku navrhl portál (26. 11. 2026) a drží ji podle názvu. Jakmile ji
   * pořadatel přepíše, příznak zmizí a portál do čísla už nemluví.
   */
  odhad?: boolean;
};

export function novyKlicPolozky(): string {
  return `n${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** Klíč cíle - skládá se na jednom místě, ať se rozpad nerozejde. */
export function klicCile(otazkaId: string, hodnota: string): string {
  return `${otazkaId}${DELIC_CILE}${hodnota}`;
}

function rozlozCil(cil: string): { otazkaId: string; hodnota: string } | null {
  const kde = cil.indexOf(DELIC_CILE);
  if (kde <= 0) return null;
  return { otazkaId: cil.slice(0, kde), hodnota: cil.slice(kde + DELIC_CILE.length) };
}

/** Co přišlo z databáze nebo z formuláře, očištěné na použitelný tvar. */
export function ocistiNakup(vstup: unknown): PolozkaNakupu[] {
  if (!Array.isArray(vstup)) return [];
  const hotove: PolozkaNakupu[] = [];
  for (const radek of vstup.slice(0, 100)) {
    if (!radek || typeof radek !== 'object') continue;
    const r = radek as Record<string, unknown>;
    const nazev = String(r.nazev ?? '').trim().slice(0, 120);
    if (!nazev) continue;
    const naOsobu = Number(r.naOsobu);
    hotove.push({
      id: String(r.id ?? '').trim().slice(0, 40) || novyKlicPolozky(),
      nazev,
      naOsobu: Number.isFinite(naOsobu) && naOsobu > 0 ? Math.min(naOsobu, 10000) : 0,
      jednotka: String(r.jednotka ?? '').trim().slice(0, 20),
      proKoho: String(r.proKoho ?? PRO_VSECHNY).trim().slice(0, 200) || PRO_VSECHNY,
      odhad: r.odhad === true,
    });
  }
  return hotove;
}

/**
 * Nabídka do sloupce „pro koho". Všichni, kdo dorazí, a pak každá odpověď
 * z ankety zvlášť - z nich se dělají řádky na pití a na hotel.
 */
export function cileNakupu(otazky: Otazka[]): { klic: string; popis: string }[] {
  const cile = [{ klic: PRO_VSECHNY, popis: 'Všichni, kdo dorazí' }];
  for (const o of otazkyPoDorazeni(otazky)) {
    if (o.typ === 'ANO_NE') {
      cile.push({ klic: klicCile(o.id, 'ano'), popis: `${o.text} — ${o.ano ?? 'ano'}` });
      cile.push({ klic: klicCile(o.id, 'ne'), popis: `${o.text} — ${o.ne ?? 'ne'}` });
    } else if (o.typ === 'VYBER') {
      for (const m of o.moznosti ?? []) cile.push({ klic: klicCile(o.id, m), popis: `${o.text} — ${m}` });
    }
  }
  return cile;
}

/** Popis cíle pro tabulku. Co ve slovníku není (smazaná otázka), projde syrové. */
export function popisCile(otazky: Otazka[], cil: string): string {
  return cileNakupu(otazky).find((c) => c.klic === cil)?.popis ?? cil;
}

/**
 * Kolik lidí na položku připadá. `jiste` jsou potvrzení, `strop` počítá i ty,
 * kdo ještě neodpověděli - u odpovědí v poměru, v jakém odpověděli ostatní.
 */
export function pocetProCil(
  pozvanky: PozvankaPrehled[],
  cil: string,
): { jiste: number; strop: number } {
  const dorazi = pozvanky.filter((p) => p.dorazi === true);
  const mlci = pozvanky.filter((p) => p.dorazi !== true && p.dorazi !== false).length;

  if (cil === PRO_VSECHNY) return { jiste: dorazi.length, strop: dorazi.length + mlci };

  const rozklad = rozlozCil(cil);
  if (!rozklad) return { jiste: 0, strop: 0 };
  const { otazkaId, hodnota } = rozklad;

  const sedi = (p: PozvankaPrehled) => {
    const odpoved = p.odpovedi[otazkaId];
    if (hodnota === 'ano') return odpoved === true;
    if (hodnota === 'ne') return odpoved === false;
    return Array.isArray(odpoved) && odpoved.includes(hodnota);
  };

  const jiste = dorazi.filter(sedi).length;
  const podil = dorazi.length > 0 ? jiste / dorazi.length : 0;
  return { jiste, strop: jiste + Math.ceil(mlci * podil) };
}

/* ------------------------------------------------------------------ *
 * ODHAD DÁVKY NA OSOBU (zadání 26. 11. 2026: „chci, abys navrhnul, kolik toho
 * na osobu na večer máme cca nakoupit odhadem - to nechci nastavovat").
 *
 * Tabulka běžných dávek NA JEDEN VEČER a na jednoho člověka. Není to věda,
 * je to to, co se v praxi nakupuje: čtyři piva, osm deka šunky, dva kusy
 * pečiva. Pořadatel napíše jen název položky a číslo si portál doplní sám;
 * přepsat ho samozřejmě jde - od té chvíle je položka „vlastní" a odhad do ní
 * nemluví.
 *
 * HLEDÁ SE PODLE KOUSKŮ SLOV v názvu, bez háčků a velikosti písmen; platí
 * nejdelší shoda, takže „sýrové tyčinky" padnou na tyčinky, ne na sýr.
 * Kmeny, ne celá slova - „pálenku" a „pálenka" musí trefit totéž. Co se
 * nepozná, dostane 1 kus na osobu: viditelně špatně, a tím pádem opravitelně.
 * ------------------------------------------------------------------ */

export type Odhad = { naOsobu: number; jednotka: string; proc: string };

const DAVKY: { slova: string[]; odhad: Odhad }[] = [
  // --- pití ---
  { slova: ['piv', 'beer'], odhad: { naOsobu: 4, jednotka: 'ks', proc: '≈ 2 litry za večer, tedy čtyři půllitry' } },
  { slova: ['vin', 'wine'], odhad: { naOsobu: 0.4, jednotka: 'l', proc: 'něco přes půl lahve na hlavu' } },
  { slova: ['sekt', 'prosecco', 'bublink', 'champagne'], odhad: { naOsobu: 0.2, jednotka: 'l', proc: 'dvě sklenky na přípitek' } },
  { slova: ['whiskey', 'whisky', 'rum', 'gin', 'vodka', 'tequila', 'destilat', 'palenk', 'slivovic', 'becherovka'], odhad: { naOsobu: 0.2, jednotka: 'l', proc: 'čtyři až pět panáků' } },
  { slova: ['nealko', 'limo', 'kofol', 'cola', 'dzus', 'juice'], odhad: { naOsobu: 1, jednotka: 'l', proc: 'litr nealka na večer' } },
  { slova: ['vod', 'mineralk'], odhad: { naOsobu: 1, jednotka: 'l', proc: 'litr vody k pití mezi' } },
  { slova: ['kav', 'coffee'], odhad: { naOsobu: 2, jednotka: 'ks', proc: 'dvě kávy' } },
  { slova: ['led', 'ice'], odhad: { naOsobu: 0.3, jednotka: 'kg', proc: 'led do sklenic' } },
  // --- jídlo ---
  { slova: ['chlebic', 'jednohub', 'canape'], odhad: { naOsobu: 4, jednotka: 'ks', proc: 'čtyři kousky na hlavu' } },
  { slova: ['sunk', 'salam', 'uzenin', 'prosciutto', 'slanin'], odhad: { naOsobu: 0.08, jednotka: 'kg', proc: 'osm deka na talíř' } },
  { slova: ['syr', 'cheese', 'hermelin', 'eidam'], odhad: { naOsobu: 0.07, jednotka: 'kg', proc: 'sedm deka na talíř' } },
  { slova: ['klobas', 'parek', 'parky', 'spekac'], odhad: { naOsobu: 0.15, jednotka: 'kg', proc: 'jedna pořádná klobása' } },
  { slova: ['maso', 'steak', 'gril', 'kure', 'veprov', 'hovez'], odhad: { naOsobu: 0.25, jednotka: 'kg', proc: 'čtvrt kila masa jako hlavní jídlo' } },
  { slova: ['ryb', 'losos', 'kapr'], odhad: { naOsobu: 0.2, jednotka: 'kg', proc: 'dvacet deka ryby' } },
  { slova: ['peciv', 'chleb', 'rohlik', 'baget', 'housk'], odhad: { naOsobu: 2, jednotka: 'ks', proc: 'dva kusy pečiva' } },
  { slova: ['brambor', 'hranolk', 'ryze', 'testovin'], odhad: { naOsobu: 0.2, jednotka: 'kg', proc: 'dvacet deka přílohy' } },
  { slova: ['salat', 'zelenin', 'okurk', 'rajc', 'paprik'], odhad: { naOsobu: 0.15, jednotka: 'kg', proc: 'patnáct deka zeleniny' } },
  { slova: ['ovoc', 'jablk', 'hrozn'], odhad: { naOsobu: 0.15, jednotka: 'kg', proc: 'patnáct deka ovoce' } },
  { slova: ['chips', 'orisk', 'tycink', 'slan', 'popcorn', 'krekr'], odhad: { naOsobu: 0.05, jednotka: 'kg', proc: 'pět deka k pivu' } },
  { slova: ['dezert', 'zakus', 'dort', 'kolac', 'cukrovi'], odhad: { naOsobu: 1, jednotka: 'ks', proc: 'jeden kousek na hlavu' } },
  { slova: ['dip', 'omack', 'kecup', 'tatark'], odhad: { naOsobu: 0.05, jednotka: 'kg', proc: 'pět deka dipu' } },
  { slova: ['polevk'], odhad: { naOsobu: 0.3, jednotka: 'l', proc: 'tři deci polévky' } },
  // --- kolem stolu ---
  { slova: ['ubrous', 'servitk'], odhad: { naOsobu: 4, jednotka: 'ks', proc: 'čtyři ubrousky' } },
  { slova: ['kelim', 'sklenic', 'talir', 'pribor', 'brcka'], odhad: { naOsobu: 2, jednotka: 'ks', proc: 'dva kusy, než se ztratí' } },
  { slova: ['pokoj', 'ubytovan', 'hotel', 'postel', 'nocleh'], odhad: { naOsobu: 1, jednotka: 'ks', proc: 'jedno lůžko na člověka' } },
];

/** Výchozí odhad, když se v názvu nic nepozná. */
const ODHAD_NEZNAMA: Odhad = { naOsobu: 1, jednotka: 'ks', proc: 'neznámá položka - jeden kus na člověka' };

function bezHacku(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/** Kolik čeho na osobu na jeden večer. Nikdy nevrací prázdno - vždy něco navrhne. */
export function odhadPolozky(nazev: string): Odhad {
  const text = bezHacku(nazev);
  if (!text) return ODHAD_NEZNAMA;
  let nejlepsi: { delka: number; odhad: Odhad } | null = null;
  for (const radek of DAVKY) {
    for (const slovo of radek.slova) {
      if (text.includes(slovo) && (!nejlepsi || slovo.length > nejlepsi.delka)) {
        nejlepsi = { delka: slovo.length, odhad: radek.odhad };
      }
    }
  }
  return nejlepsi?.odhad ?? ODHAD_NEZNAMA;
}

/** Co pořadatel vůbec nemá kupovat - „donesu si vlastní", „nic nepiju". */
function neniKNakupu(nazev: string): boolean {
  const text = bezHacku(nazev);
  return ['vlastni', 'nic ', 'nepiju', 'nepiji', 'zadn'].some((s) => text.includes(s));
}

/**
 * NÁVRH CELÉHO NÁKUPU. Pití se vezme z ankety - každá možnost, kterou někdo
 * může zaškrtnout, je jeden řádek počítaný jen těm, kdo ji zaškrtli. K tomu
 * základ, který se na večírku kupuje vždycky, pro všechny, kdo dorazí.
 *
 * Co už v seznamu je, se nepřidává znovu (podle názvu a cíle), takže se dá
 * zmáčknout i nad rozdělanou tabulkou.
 */
const ZAKLAD_VECERA = ['Pečivo', 'Šunka', 'Sýr', 'Zelenina', 'Slané', 'Dezert', 'Voda', 'Ubrousky'];

export function navrhNakupu(otazky: Otazka[], stavajici: PolozkaNakupu[] = []): PolozkaNakupu[] {
  const uz = new Set(stavajici.map((p) => `${bezHacku(p.nazev)}|${p.proKoho}`));
  const pridane: PolozkaNakupu[] = [];

  const pridej = (nazev: string, proKoho: string) => {
    const klic = `${bezHacku(nazev)}|${proKoho}`;
    if (uz.has(klic) || neniKNakupu(nazev)) return;
    uz.add(klic);
    const odhad = odhadPolozky(nazev);
    pridane.push({
      id: novyKlicPolozky(),
      nazev,
      naOsobu: odhad.naOsobu,
      jednotka: odhad.jednotka,
      proKoho,
      odhad: true,
    });
  };

  for (const o of otazkyPoDorazeni(otazky)) {
    if (o.typ === 'VYBER') {
      for (const m of o.moznosti ?? []) pridej(m, klicCile(o.id, m));
    } else if (o.typ === 'ANO_NE') {
      // Ano/ne otázka se do nákupu hodí jen tam, kde se za „ano" něco kupuje
      // (ubytování), proto podle názvu - ne každé „ano" je položka.
      if (!neniKNakupu(o.text) && odhadPolozky(o.text) !== ODHAD_NEZNAMA) {
        pridej(o.text, klicCile(o.id, 'ano'));
      }
    }
  }

  for (const nazev of ZAKLAD_VECERA) pridej(nazev, PRO_VSECHNY);

  return [...stavajici, ...pridane];
}

/** Kolik toho koupit. Dvě desetinná místa - 0,08 kg na osobu je běžná dávka. */
export function mnozstviPolozky(naOsobu: number, pocet: number): number {
  return Math.round(naOsobu * pocet * 100) / 100;
}

/**
 * Odpovědi po řádcích - otázka a co na ni ten člověk odpověděl. Do potvrzení
 * a připomínky, kde je na tabulku místo (na rozdíl od seznamu pozvaných,
 * kde se vejde jedna věta - viz popisOdpovedi níž).
 */
export function radkyOdpovedi(otazky: Otazka[], odpovedi: Odpovedi): { otazka: string; odpoved: string }[] {
  const radky: { otazka: string; odpoved: string }[] = [];
  for (const o of otazkyPoDorazeni(otazky)) {
    const hodnota = odpovedi[o.id];
    if (hodnota === undefined) continue;
    const odpoved =
      o.typ === 'ANO_NE'
        ? hodnota
          ? (o.ano ?? 'Ano')
          : (o.ne ?? 'Ne')
        : Array.isArray(hodnota)
          ? hodnota.join(', ')
          : String(hodnota);
    if (odpoved.trim()) radky.push({ otazka: o.text, odpoved });
  }
  return radky;
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
