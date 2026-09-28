/**
 * STÁTNÍ SVÁTKY V KALENDÁŘI (zadání 28. 9. 2026: „u svátků v kalendáři dej
 * u toho termínu nějakou nenápadnou ikonu, když bude v ten den svátek. Po
 * kliknutí na ikonu se zobrazí i krátký popis toho svátku. V českých
 * kalendářích české svátky a v londýnském ty britské").
 *
 * POČÍTÁ SE TO, NETAHÁ ZE SÍTĚ. Svátky jsou dané pravidly, ne novinkami -
 * stačí je jednou napsat a platí dozadu i dopředu. Portál tak nezávisí na
 * cizí službě, kalendář se kvůli tomu nezpomalí a funguje i bez internetu.
 * Data byla ověřená proti gov.uk/bank-holidays.json (Anglie a Wales).
 *
 * ZEMĚ SE BERE Z ČASOVÉHO PÁSMA STUDIA, ne z nového sloupce v databázi -
 * Studio.timezone už rozlišuje Europe/London od Europe/Prague a víc k tomu
 * není potřeba vědět.
 *
 * Tohle NENÍ druh události „Svátek" (BLOCK_KIND_LABELS.HOLIDAY). Ten si zapíše
 * člověk ručně, tohle je automatická značka u data.
 */

export type Zeme = 'CZ' | 'GB';

export type Svatek = {
  /** Stabilní klíč, ať se dá svátek poznat i bez textu. */
  klic: string;
  nazev: { cs: string; en: string };
  popis: { cs: string; en: string };
  /** Náhradní volno za svátek, který padl na víkend (jen Británie). */
  nahradni?: boolean;
};

/** Anglie a Wales, nebo Česko - podle pásma studia. */
export function zemePodlePasma(timezone: string | null | undefined): Zeme {
  return timezone === 'Europe/London' ? 'GB' : 'CZ';
}

/** „2026-09-28" z roku, měsíce (1-12) a dne. */
function klicDne(rok: number, mesic: number, den: number): string {
  return `${rok}-${String(mesic).padStart(2, '0')}-${String(den).padStart(2, '0')}`;
}

/**
 * Velikonoční neděle podle gregoriánského výpočtu (Meeus/Jones/Butcher).
 * Od ní se odvozuje Velký pátek i Velikonoční pondělí v obou zemích.
 */
function velikonocniNedele(rok: number): { mesic: number; den: number } {
  const a = rok % 19;
  const b = Math.floor(rok / 100);
  const c = rok % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mesic = Math.floor((h + l - 7 * m + 114) / 31);
  const den = ((h + l - 7 * m + 114) % 31) + 1;
  return { mesic, den };
}

/** Posun o dny od data; počítá se v UTC, aby do toho nemluvil letní čas. */
function posun(rok: number, mesic: number, den: number, oDnu: number): string {
  const d = new Date(Date.UTC(rok, mesic - 1, den));
  d.setUTCDate(d.getUTCDate() + oDnu);
  return d.toISOString().slice(0, 10);
}

/** Den v týdnu (0 = neděle) pro datum bez vlivu časového pásma. */
function denVTydnu(iso: string): number {
  return new Date(`${iso}T12:00:00.000Z`).getUTCDay();
}

/** N-té pondělí v měsíci, např. první pondělí v květnu. */
function pondeliVMesici(rok: number, mesic: number, kolikate: number): string {
  const prvni = new Date(Date.UTC(rok, mesic - 1, 1));
  const posunNaPondeli = (8 - prvni.getUTCDay()) % 7;
  const den = 1 + posunNaPondeli + (kolikate - 1) * 7;
  return klicDne(rok, mesic, den);
}

/** Poslední pondělí v měsíci - jarní a letní britský bank holiday. */
function posledniPondeliVMesici(rok: number, mesic: number): string {
  const posledni = new Date(Date.UTC(rok, mesic, 0));
  const zpet = (posledni.getUTCDay() + 6) % 7;
  posledni.setUTCDate(posledni.getUTCDate() - zpet);
  return posledni.toISOString().slice(0, 10);
}

/**
 * ČESKÉ SVÁTKY (zákon č. 245/2000 Sb.) - státní svátky i ostatní svátky
 * dohromady, protože pro plánování natáčení je rozdíl mezi nimi jedno:
 * v obou případech se netočí.
 */
function svatkyCZ(rok: number): Map<string, Svatek> {
  const m = new Map<string, Svatek>();
  const velikonoce = velikonocniNedele(rok);

  const pridej = (iso: string, s: Svatek) => m.set(iso, s);

  pridej(klicDne(rok, 1, 1), {
    klic: 'cz.novyRok',
    nazev: { cs: 'Nový rok a Den obnovy samostatného českého státu', en: "New Year's Day" },
    popis: {
      cs: 'Začátek roku a zároveň výročí vzniku samostatné České republiky v roce 1993.',
      en: 'The start of the year and the anniversary of the Czech Republic becoming independent in 1993.',
    },
  });
  pridej(posun(rok, velikonoce.mesic, velikonoce.den, -2), {
    klic: 'cz.velkyPatek',
    nazev: { cs: 'Velký pátek', en: 'Good Friday' },
    popis: {
      cs: 'Pátek před Velikonocemi, připomínka ukřižování Ježíše Krista. Volným dnem je v Česku od roku 2016.',
      en: 'The Friday before Easter, marking the crucifixion of Jesus Christ. A public holiday in Czechia since 2016.',
    },
  });
  pridej(posun(rok, velikonoce.mesic, velikonoce.den, 1), {
    klic: 'cz.velikonocniPondeli',
    nazev: { cs: 'Velikonoční pondělí', en: 'Easter Monday' },
    popis: {
      cs: 'Pondělí po Velikonocích, u nás spojené s tradicí pomlázky.',
      en: 'The Monday after Easter, traditionally marked in Czechia with the pomlázka.',
    },
  });
  pridej(klicDne(rok, 5, 1), {
    klic: 'cz.svatekPrace',
    nazev: { cs: 'Svátek práce', en: 'Labour Day' },
    popis: {
      cs: 'Mezinárodní den pracujících, připomínka stávky v Chicagu roku 1886.',
      en: 'International Workers’ Day, commemorating the 1886 Chicago strike.',
    },
  });
  pridej(klicDne(rok, 5, 8), {
    klic: 'cz.denVitezstvi',
    nazev: { cs: 'Den vítězství', en: 'Victory in Europe Day' },
    popis: {
      cs: 'Konec druhé světové války v Evropě v roce 1945.',
      en: 'The end of the Second World War in Europe in 1945.',
    },
  });
  pridej(klicDne(rok, 7, 5), {
    klic: 'cz.cyrilMetodej',
    nazev: { cs: 'Den slovanských věrozvěstů Cyrila a Metoděje', en: 'Saints Cyril and Methodius Day' },
    popis: {
      cs: 'Příchod byzantské mise na Velkou Moravu roku 863 a s ní i písma.',
      en: 'The arrival of the Byzantine mission — and of writing — in Great Moravia in 863.',
    },
  });
  pridej(klicDne(rok, 7, 6), {
    klic: 'cz.janHus',
    nazev: { cs: 'Den upálení mistra Jana Husa', en: 'Jan Hus Day' },
    popis: {
      cs: 'Upálení Jana Husa v Kostnici roku 1415.',
      en: 'The burning of Jan Hus at Konstanz in 1415.',
    },
  });
  pridej(klicDne(rok, 9, 28), {
    klic: 'cz.ceskaStatnost',
    nazev: { cs: 'Den české státnosti', en: 'Czech Statehood Day' },
    popis: {
      cs: 'Svátek svatého Václava, patrona české země.',
      en: 'The feast of Saint Wenceslas, patron saint of the Czech lands.',
    },
  });
  pridej(klicDne(rok, 10, 28), {
    klic: 'cz.vznikCSR',
    nazev: { cs: 'Den vzniku samostatného československého státu', en: 'Independent Czechoslovak State Day' },
    popis: {
      cs: 'Vyhlášení Československa roku 1918.',
      en: 'The founding of Czechoslovakia in 1918.',
    },
  });
  pridej(klicDne(rok, 11, 17), {
    klic: 'cz.bojZaSvobodu',
    nazev: {
      cs: 'Den boje za svobodu a demokracii a Mezinárodní den studentstva',
      en: 'Struggle for Freedom and Democracy Day',
    },
    popis: {
      cs: 'Studentské demonstrace roku 1939 a 1989 - začátek sametové revoluce.',
      en: 'The student demonstrations of 1939 and 1989 — the start of the Velvet Revolution.',
    },
  });
  pridej(klicDne(rok, 12, 24), {
    klic: 'cz.stedryDen',
    nazev: { cs: 'Štědrý den', en: 'Christmas Eve' },
    popis: {
      cs: 'Štědrý večer s večeří a nadílkou - u nás hlavní den Vánoc.',
      en: 'Christmas Eve, with dinner and presents — the main day of Christmas in Czechia.',
    },
  });
  pridej(klicDne(rok, 12, 25), {
    klic: 'cz.bozeHody',
    nazev: { cs: '1. svátek vánoční', en: 'Christmas Day' },
    popis: { cs: 'Boží hod vánoční.', en: 'Christmas Day.' },
  });
  pridej(klicDne(rok, 12, 26), {
    klic: 'cz.stepan',
    nazev: { cs: '2. svátek vánoční', en: 'St Stephen’s Day' },
    popis: { cs: 'Svátek svatého Štěpána.', en: 'The feast of Saint Stephen.' },
  });

  return m;
}

/**
 * BRITSKÉ BANK HOLIDAYS - Anglie a Wales (studio London).
 *
 * NÁHRADNÍ VOLNO: svátek s pevným datem, který padne na sobotu nebo neděli,
 * se přesouvá na nejbližší další pracovní den. Na přelomu roku se proto umí
 * sejít 25. i 26. 12. a posunout se až na 27. a 28. Bez tohohle pravidla by
 * kalendář ukazoval volno o víkendu a v pondělí práci, tedy přesně naopak.
 */
function svatkyGB(rok: number): Map<string, Svatek> {
  const m = new Map<string, Svatek>();
  const velikonoce = velikonocniNedele(rok);

  /** Zapíše svátek; když padne na víkend, přidá k němu náhradní volno. */
  const sNahradou = (iso: string, s: Svatek) => {
    m.set(iso, s);
    const dow = denVTydnu(iso);
    if (dow !== 0 && dow !== 6) return;
    // Sobota → pondělí, neděle → pondělí; obsazené pondělí posune na úterý.
    let nahrada = posun(
      Number(iso.slice(0, 4)),
      Number(iso.slice(5, 7)),
      Number(iso.slice(8, 10)),
      dow === 6 ? 2 : 1,
    );
    while (m.has(nahrada)) {
      nahrada = posun(
        Number(nahrada.slice(0, 4)),
        Number(nahrada.slice(5, 7)),
        Number(nahrada.slice(8, 10)),
        1,
      );
    }
    m.set(nahrada, {
      klic: `${s.klic}.nahradni`,
      nahradni: true,
      nazev: {
        cs: `${s.nazev.cs} - náhradní volno`,
        en: `${s.nazev.en} (substitute day)`,
      },
      popis: {
        cs: `${s.popis.cs} Svátek padl na víkend, volno se proto přesouvá na tenhle den.`,
        en: `${s.popis.en} The holiday fell at a weekend, so the day off moves here.`,
      },
    });
  };

  sNahradou(klicDne(rok, 1, 1), {
    klic: 'gb.novyRok',
    nazev: { cs: 'Nový rok', en: "New Year's Day" },
    popis: { cs: 'První den roku.', en: 'The first day of the year.' },
  });
  m.set(posun(rok, velikonoce.mesic, velikonoce.den, -2), {
    klic: 'gb.velkyPatek',
    nazev: { cs: 'Velký pátek', en: 'Good Friday' },
    popis: {
      cs: 'Pátek před Velikonocemi, připomínka ukřižování Ježíše Krista.',
      en: 'The Friday before Easter, marking the crucifixion of Jesus Christ.',
    },
  });
  m.set(posun(rok, velikonoce.mesic, velikonoce.den, 1), {
    klic: 'gb.velikonocniPondeli',
    nazev: { cs: 'Velikonoční pondělí', en: 'Easter Monday' },
    popis: { cs: 'Pondělí po Velikonocích.', en: 'The Monday after Easter.' },
  });
  m.set(pondeliVMesici(rok, 5, 1), {
    klic: 'gb.earlyMay',
    nazev: { cs: 'Májový svátek', en: 'Early May bank holiday' },
    popis: {
      cs: 'První pondělí v květnu, britská obdoba svátku práce.',
      en: 'The first Monday in May, the British equivalent of Labour Day.',
    },
  });
  m.set(posledniPondeliVMesici(rok, 5), {
    klic: 'gb.spring',
    nazev: { cs: 'Jarní svátek', en: 'Spring bank holiday' },
    popis: { cs: 'Poslední pondělí v květnu.', en: 'The last Monday in May.' },
  });
  m.set(posledniPondeliVMesici(rok, 8), {
    klic: 'gb.summer',
    nazev: { cs: 'Letní svátek', en: 'Summer bank holiday' },
    popis: {
      cs: 'Poslední pondělí v srpnu, konec britských prázdnin.',
      en: 'The last Monday in August, the end of the British summer break.',
    },
  });
  sNahradou(klicDne(rok, 12, 25), {
    klic: 'gb.christmas',
    nazev: { cs: '1. svátek vánoční', en: 'Christmas Day' },
    popis: { cs: 'Boží hod vánoční.', en: 'Christmas Day.' },
  });
  sNahradou(klicDne(rok, 12, 26), {
    klic: 'gb.boxingDay',
    nazev: { cs: '2. svátek vánoční', en: 'Boxing Day' },
    popis: {
      cs: 'Den po Vánocích, tradičně den obdarovávání.',
      en: 'The day after Christmas, traditionally a day for giving boxes.',
    },
  });

  return m;
}

/** Svátky jednoho roku pro danou zemi. Klíčem je „YYYY-MM-DD". */
export function svatkyVRoce(rok: number, zeme: Zeme): Map<string, Svatek> {
  return zeme === 'GB' ? svatkyGB(rok) : svatkyCZ(rok);
}

/**
 * Svátky pro sadu zemí a rozsah dnů - to, co potřebuje kalendář.
 *
 * Kalendář umí ukázat víc studií naráz, a to i z různých zemí. Pak se u dne
 * sejde víc svátků; proto mapa vede POLE a v bublině se u každého svátku
 * ukáže, které země se týká.
 */
export function svatkyProDny(
  dnyIso: string[],
  zeme: Zeme[],
): Map<string, { zeme: Zeme; svatek: Svatek }[]> {
  const vysledek = new Map<string, { zeme: Zeme; svatek: Svatek }[]>();
  if (dnyIso.length === 0 || zeme.length === 0) return vysledek;

  const roky = Array.from(new Set(dnyIso.map((d) => Number(d.slice(0, 4))))).filter(
    (r) => Number.isFinite(r) && r > 1900 && r < 2200,
  );
  const unikatniZeme = Array.from(new Set(zeme));
  const tabulky = new Map<string, Map<string, Svatek>>();
  for (const z of unikatniZeme) {
    for (const rok of roky) tabulky.set(`${z}:${rok}`, svatkyVRoce(rok, z));
  }

  for (const den of dnyIso) {
    const rok = Number(den.slice(0, 4));
    const nalezy: { zeme: Zeme; svatek: Svatek }[] = [];
    for (const z of unikatniZeme) {
      const s = tabulky.get(`${z}:${rok}`)?.get(den);
      if (s) nalezy.push({ zeme: z, svatek: s });
    }
    if (nalezy.length) vysledek.set(den, nalezy);
  }
  return vysledek;
}

/** Název země do bubliny, když se v kalendáři potkají obě. */
export const NAZVY_ZEMI: Record<Zeme, { cs: string; en: string }> = {
  CZ: { cs: 'Česko', en: 'Czechia' },
  GB: { cs: 'Velká Británie', en: 'United Kingdom' },
};
