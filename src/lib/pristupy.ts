import type { Role } from '@prisma/client';

/**
 * PŘÍSTUPY DO SEKCÍ A JEDNOTLIVÁ PRÁVA (zadání 28. 9. 2026: „potřeboval bych
 * postupně předělat tu sekci, kde rozkliknu já jako superadmin uživatele
 * a tam mu pomocí zaškrtávacích polí dávám přístup jednotlivým sekcím",
 * upřesněno tentýž den: „chci třeba u dokladů, projektů a kalendáře více
 * jednotlivých parametrů. Třeba aby někdo mohl vidět, vystavovat nabídky,
 * faktury atd.").
 *
 * DVĚ ÚROVNĚ. Sekce je velký vypínač (Doklady ano/ne) a pod ní jsou práva
 * (vidí faktury / vystavuje faktury). Obojí se ukládá do stejného seznamu
 * `User.pristupy`: sekce jako „DOKLADY", právo jako „DOKLADY.FAKTURY_VYSTAVIT".
 * Jedno pole schválně - kdyby to byly dvě tabulky, museli by se držet
 * v souladu a první rozejití by nikdo nepoznal.
 *
 * TŘI PRAVIDLA, KTERÁ SE NESMÍ ROZEJÍT:
 *
 *  1. SUPERADMIN MÁ VŠECHNO. Zaškrtávátka se u něj neřeší a jako jediný je
 *     rozdává. Bez téhle pojistky by se dal poslední správce zamknout ze
 *     správy uživatelů a nikdo by se tam už nedostal.
 *  2. ZAŠKRTÁVÁTKA JSOU JEN PRO NÁŠ TÝM. Klient, herec, tabule a klient
 *     studia mají vlastní úzký portál a ten se tímhle neřídí - viz
 *     `podlehaPristupum`.
 *  3. SEKCE BEZ UPŘESNĚNÍ ZNAMENÁ „VŠECHNA JEJÍ PRÁVA". Když je v seznamu
 *     „DOKLADY" a žádné právo z Dokladů, platí celá sekce. Díky tomu nic
 *     nespadlo účtům založeným před tímhle rozpadem a prázdný detail se
 *     nikdy nechová jako zákaz.
 *
 * Soubor je BEZ PRISMY kvůli typu Role - používá ho i lišta v prohlížeči.
 */

export type KlicSekce =
  | 'PROJEKTY'
  | 'DOKLADY'
  | 'PREHLEDY'
  | 'KALENDARE'
  | 'STUDIA'
  | 'FIRMY'
  | 'ZPRAVY_PORTALU'
  | 'HERCI'
  | 'KLIENTI';

export type Pravo = {
  /** Celý klíč i se sekcí, např. „DOKLADY.FAKTURY_VYSTAVIT". */
  klic: string;
  nazev: string;
  /** Jedna věta k zaškrtávátku - co člověk smí, když mu to dáš. */
  popis: string;
  /** Cesty, které tohle právo otevírá (i všechno pod nimi). */
  cesty?: string[];
};

export type Sekce = {
  klic: KlicSekce;
  nazev: string;
  popis: string;
  /** Klíč kresby z lib/ikonyTypu.tsx - stejná rodina jako ikony typů projektu. */
  ikona: string;
  /**
   * Cesty, které sekce otevírá. Bere se i všechno pod nimi, takže
   * `/admin/doklady` pustí i `/admin/doklady/faktury/123`.
   */
  cesty: string[];
  prava: Pravo[];
};

export const SEKCE: Sekce[] = [
  {
    klic: 'PROJEKTY',
    ikona: 'klapka',
    nazev: 'Projekty',
    popis: 'Seznam projektů a jejich detail - stav, herci, termíny, výstupy.',
    cesty: ['/projekty', '/admin/nastaveni/projekty'],
    prava: [
      {
        klic: 'PROJEKTY.UPRAVY',
        nazev: 'Upravuje údaje projektu',
        popis: 'Mění stav, typ, manažera, termíny a odkazy. Bez toho je detail jen ke čtení.',
      },
      {
        klic: 'PROJEKTY.ROZPOCET',
        nazev: 'Vidí rozpočet a výkazy',
        popis: 'Záložka Rozpočet u projektu - kolik je naplánováno a kolik se protočilo.',
      },
      {
        klic: 'PROJEKTY.DOKLADY',
        nazev: 'Vidí doklady u projektu',
        popis: 'Nabídky, faktury a výdaje navázané na zakázku přímo v detailu projektu.',
      },
      {
        klic: 'PROJEKTY.KLIENT',
        nazev: 'Vidí klienta a datum vydání',
        popis: 'Obchodní část karty. Zvukař ji dosud neměl.',
      },
      {
        klic: 'PROJEKTY.VPRIPRAVE',
        nazev: 'Vidí projekty V přípravě',
        popis: 'Zakázky, které ještě nemají termín ani herce - jinak se objeví až v Natáčíme.',
      },
      {
        klic: 'PROJEKTY.TECHNICKE_PARAMETRY',
        nazev: 'Upravuje technické parametry',
        popis: 'Sady formátů u firem. Číst je smí celý tým, měnit jen tenhle člověk.',
        cesty: ['/admin/technicke-parametry'],
      },
    ],
  },
  {
    klic: 'DOKLADY',
    ikona: 'dokument',
    nazev: 'Doklady',
    popis: 'Nabídky, faktury, výdaje, smlouvy a moje firmy. Jsou tam peníze celé firmy.',
    cesty: ['/admin/doklady', '/admin/nastaveni/doklady'],
    prava: [
      {
        klic: 'DOKLADY.NABIDKY_CIST',
        nazev: 'Vidí nabídky',
        popis: 'Seznam a detail cenových nabídek.',
        cesty: ['/admin/doklady/nabidky'],
      },
      {
        klic: 'DOKLADY.NABIDKY_VYSTAVIT',
        nazev: 'Vystavuje nabídky',
        popis: 'Zakládá, mění a posílá nabídky klientovi.',
      },
      {
        klic: 'DOKLADY.FAKTURY_CIST',
        nazev: 'Vidí faktury',
        popis: 'Seznam a detail vydaných faktur.',
        cesty: ['/admin/doklady/faktury'],
      },
      {
        klic: 'DOKLADY.FAKTURY_VYSTAVIT',
        nazev: 'Vystavuje faktury',
        popis: 'Zakládá a posílá faktury. Číslo faktury se nikdy nemění.',
      },
      {
        klic: 'DOKLADY.UPOMINKY',
        nazev: 'Řeší upomínky',
        popis: 'Nezaplacené faktury a upomínání klientů.',
        cesty: ['/admin/doklady/upominky'],
      },
      {
        klic: 'DOKLADY.VYDAJE_CIST',
        nazev: 'Vidí výdaje',
        popis: 'Náklady zakázek a režie.',
        cesty: ['/admin/doklady/vydaje'],
      },
      {
        klic: 'DOKLADY.VYDAJE_ZAPIS',
        nazev: 'Zapisuje výdaje',
        popis: 'Přidává a mění výdaje včetně příloh.',
      },
      {
        klic: 'DOKLADY.SMLOUVY_CIST',
        nazev: 'Vidí smlouvy',
        popis: 'Smlouvy s herci a jejich vzory.',
        cesty: ['/admin/doklady/smlouvy'],
      },
      {
        klic: 'DOKLADY.SMLOUVY_ODESLAT',
        nazev: 'Posílá smlouvy k podpisu',
        popis: 'Vytvoří smlouvu ze vzoru a pošle ji druhé straně.',
      },
      {
        klic: 'DOKLADY.MOJE_FIRMY',
        nazev: 'Spravuje naše firmy',
        popis: 'Fakturační údaje firem, ze kterých vystavujeme.',
        cesty: ['/admin/doklady/moje-firmy'],
      },
      {
        klic: 'DOKLADY.BANKA',
        nazev: 'Vidí Banku',
        popis: 'Bankovní výpisy a párování plateb k fakturám.',
        cesty: ['/admin/doklady/banka'],
      },
    ],
  },
  {
    klic: 'PREHLEDY',
    ikona: 'ekvalizer',
    nazev: 'Přehledy',
    popis: 'Kapacita studií, backlog, obrat a zisk, knihy a rozpočty.',
    cesty: ['/prehledy', '/backlog'],
    prava: [
      {
        klic: 'PREHLEDY.PALUBOVKA',
        nazev: 'Palubovka',
        popis: 'Ukazatele celé firmy na jedné obrazovce.',
        cesty: ['/prehledy/palubovka', '/palubovka'],
      },
      {
        klic: 'PREHLEDY.KAPACITA',
        nazev: 'Kapacita studií',
        popis: 'Kolik je ve studiích volno a kde se tlačíme.',
        cesty: ['/prehledy/kapacita'],
      },
      {
        klic: 'PREHLEDY.BACKLOG',
        nazev: 'Backlog',
        popis: 'Co je objednané a čeká na zařazení.',
        cesty: ['/prehledy/backlog', '/backlog'],
      },
      {
        klic: 'PREHLEDY.KNIHY',
        nazev: 'Knihy a rozpočty',
        popis: 'Čerpání rozpočtů audioknih, zisk a porada nad nimi.',
        cesty: ['/prehledy/knihy'],
      },
      {
        klic: 'PREHLEDY.FINANCE',
        nazev: 'Obrat a zisk',
        popis: 'Finanční přehled firmy po měsících.',
        cesty: ['/prehledy/finance'],
      },
      {
        klic: 'PREHLEDY.ZVUKARI',
        nazev: 'Výkony zvukařů',
        popis: 'Kdo kolik natočil a sestříhal.',
        cesty: ['/prehledy/zvukari'],
      },
    ],
  },
  {
    klic: 'KALENDARE',
    ikona: 'hodiny',
    nazev: 'Kalendáře',
    popis: 'Kalendáře studií - natáčení, střihy, blokace a nepřítomnosti.',
    cesty: ['/kalendar'],
    prava: [
      {
        klic: 'KALENDARE.ZAPIS',
        nazev: 'Zakládá a mění bloky',
        popis: 'Natáčení, střihy a externí pronájmy. Bez toho je kalendář jen ke čtení.',
      },
      {
        klic: 'KALENDARE.NABIDKY_TERMINU',
        nazev: 'Nabízí termíny hercům',
        popis: 'Sestavuje nabídku termínů, potvrzuje a ruší rezervace herců.',
      },
      {
        klic: 'KALENDARE.NEPRITOMNOSTI',
        nazev: 'Zapisuje nepřítomnosti',
        popis: 'Dovolené, blokace studia a údržbu.',
      },
      {
        klic: 'KALENDARE.VSICHNI_LIDE',
        nazev: 'Vidí kalendář všech',
        popis: 'Bez toho člověk vidí jen svoje bloky a bloky svých studií.',
      },
    ],
  },
  {
    klic: 'STUDIA',
    ikona: 'mikrofon-studio',
    nazev: 'Studia',
    popis: 'Nastavení studií, rezervační kalendář a ceník studia.',
    cesty: ['/studio', '/admin/studia', '/cenik-studia'],
    prava: [
      {
        klic: 'STUDIA.REZERVACE',
        nazev: 'Rezervační kalendář',
        popis: 'Bookování studia pro klienty zvenčí.',
        cesty: ['/studio'],
      },
      {
        klic: 'STUDIA.NASTAVENI',
        nazev: 'Nastavení studií',
        popis: 'Pobočky, místnosti, otevírací doba, vedoucí.',
        cesty: ['/admin/studia'],
      },
      {
        klic: 'STUDIA.CENIK',
        nazev: 'Ceník studia',
        popis: 'Ceny za hodinu a den, PDF a odeslání klientovi.',
        cesty: ['/cenik-studia'],
      },
    ],
  },
  {
    klic: 'FIRMY',
    ikona: 'stitek',
    nazev: 'Firmy',
    popis: 'Klienti a dodavatelé - karty firem, sazby a kontakty.',
    cesty: ['/admin', '/admin/companies'],
    prava: [
      {
        klic: 'FIRMY.UPRAVY',
        nazev: 'Upravuje karty firem',
        popis: 'Zakládá firmy a mění jejich údaje. Bez toho je seznam jen ke čtení.',
      },
      {
        klic: 'FIRMY.SAZBY',
        nazev: 'Ceníky a sazby',
        popis: 'Sazby za normostranu a ceníky prací.',
        cesty: ['/admin/ceniky'],
      },
    ],
  },
  {
    klic: 'ZPRAVY_PORTALU',
    ikona: 'zvonek',
    nazev: 'Zprávy z portálu',
    popis: 'Vzory zpráv, které portál posílá ven, a hlášky v rozhraní.',
    cesty: ['/admin/zpravy-portalu', '/admin/vzory-zprav'],
    prava: [
      {
        klic: 'ZPRAVY_PORTALU.VZORY',
        nazev: 'Vzory e-mailů',
        popis: 'Texty, které portál posílá klientům a hercům.',
        cesty: ['/admin/vzory-zprav'],
      },
      {
        klic: 'ZPRAVY_PORTALU.HLASKY',
        nazev: 'Hlášky v portálu',
        popis: 'Texty uvnitř rozhraní a jejich překlady.',
        cesty: ['/admin/zpravy-portalu'],
      },
    ],
  },
  {
    klic: 'HERCI',
    ikona: 'lide',
    nazev: 'Herci',
    popis: 'Karty herců, pozvánky a jejich údaje.',
    cesty: ['/pozvanky'],
    prava: [
      {
        klic: 'HERCI.UPRAVY',
        nazev: 'Upravuje karty herců',
        popis: 'Mění údaje na kartě herce. Bez toho je seznam jen ke čtení.',
      },
      {
        klic: 'HERCI.POZVANKY',
        nazev: 'Posílá pozvánky a žádosti o údaje',
        popis: 'Zve herce do portálu a posílá odkaz na doplnění údajů.',
        cesty: ['/pozvanky', '/admin/udaje'],
      },
      {
        klic: 'HERCI.HONORARE',
        nazev: 'Vidí honoráře herců',
        popis: 'Kolik komu za natáčení náleží.',
      },
    ],
  },
  {
    klic: 'KLIENTI',
    ikona: 'klic',
    nazev: 'Klienti',
    popis: 'Karty klientských účtů a jejich nastavení.',
    cesty: [],
    prava: [
      {
        klic: 'KLIENTI.UPRAVY',
        nazev: 'Upravuje klientské účty',
        popis: 'Zakládá přístupy klientům a mění je. Bez toho je seznam jen ke čtení.',
      },
    ],
  },
];

const PODLE_KLICE = new Map(SEKCE.map((s) => [s.klic, s]));

/** Všechna práva jedné sekce - jen klíče. */
export function pravaSekce(klic: KlicSekce): string[] {
  return (PODLE_KLICE.get(klic)?.prava ?? []).map((p) => p.klic);
}

/** Sekce, do které klíč patří. „DOKLADY.FAKTURY_CIST" → „DOKLADY". */
export function sekcePrava(klic: string): KlicSekce | null {
  const zaklad = klic.split('.')[0] as KlicSekce;
  return PODLE_KLICE.has(zaklad) ? zaklad : null;
}

/** Sekce i se všemi právy - co se zaškrtne, když dáváš celou sekci. */
export function celaSekce(klic: KlicSekce): string[] {
  return [klic, ...pravaSekce(klic)];
}

/** Všechny cesty, o kterých zaškrtávátka rozhodují - ostatní zůstávají na roli. */
export const CESTY_SEKCI: { cesta: string; klic: string }[] = SEKCE.flatMap((s) => [
  ...s.cesty.map((cesta) => ({ cesta, klic: s.klic as string })),
  ...s.prava.flatMap((p) => (p.cesty ?? []).map((cesta) => ({ cesta, klic: p.klic }))),
]);

/**
 * VÝCHOZÍ SADA PODLE ROLE. Tohle NENÍ pravidlo přístupu - je to jen to, co se
 * předvyplní novému člověku a co se jednorázově doplnilo stávajícím účtům,
 * aby se jim nic neztratilo. Sedí s tím, co která role viděla do 28. 9. 2026.
 */
export const VYCHOZI_PRISTUPY: Record<string, string[]> = {
  ADMIN: [
    ...celaSekce('PROJEKTY'),
    ...celaSekce('DOKLADY'),
    ...celaSekce('PREHLEDY'),
    ...celaSekce('KALENDARE'),
    ...celaSekce('STUDIA'),
    ...celaSekce('FIRMY'),
    ...celaSekce('ZPRAVY_PORTALU'),
    ...celaSekce('HERCI'),
    ...celaSekce('KLIENTI'),
  ],
  PRODUKCE: [
    'PROJEKTY',
    'PROJEKTY.UPRAVY',
    'PROJEKTY.ROZPOCET',
    'PROJEKTY.KLIENT',
    'PROJEKTY.VPRIPRAVE',
    'PREHLEDY',
    'PREHLEDY.KAPACITA',
    'PREHLEDY.BACKLOG',
    'PREHLEDY.KNIHY',
    'KALENDARE',
    'KALENDARE.ZAPIS',
    'KALENDARE.NABIDKY_TERMINU',
    'KALENDARE.NEPRITOMNOSTI',
    'KALENDARE.VSICHNI_LIDE',
    'STUDIA',
    'STUDIA.REZERVACE',
    'STUDIA.CENIK',
    'HERCI',
    'HERCI.UPRAVY',
    'HERCI.POZVANKY',
  ],
  ZVUKAR: [
    'PROJEKTY',
    'KALENDARE',
    'KALENDARE.VSICHNI_LIDE',
    'STUDIA',
    'STUDIA.REZERVACE',
  ],
};

/** Řídí se účet téhle role zaškrtávátky? Klienti a herci mají vlastní portál. */
export function podlehaPristupum(role: Role | string): boolean {
  return role === 'ADMIN' || role === 'PRODUKCE' || role === 'ZVUKAR';
}

export type KdoPristupy = {
  role: Role | string;
  superadmin?: boolean | null;
  pristupy?: string[] | null;
};

/**
 * Smí tenhle člověk na tenhle klíč? Bere sekci („DOKLADY") i právo
 * („DOKLADY.FAKTURY_VYSTAVIT").
 *
 * Superadmin všude. Kdo se zaškrtávátky neřídí (klient, herec, tabule, klient
 * studia), tomu tahle funkce neodpovídá - o něm rozhoduje dál role, takže
 * vrací `false` a volající se ptá jinak.
 */
export function maPristup(kdo: KdoPristupy, klic: string): boolean {
  if (kdo.superadmin) return true;
  if (!podlehaPristupum(kdo.role)) return false;

  const seznam = kdo.pristupy ?? [];
  /**
   * PRÁZDNÝ SEZNAM ZNAMENÁ „JEŠTĚ NENASTAVENO", NE „NIKAM NESMÍ".
   *
   * Pojistka z 28. 9. 2026: první doplnění stávajícím účtům neproběhlo
   * (čerstvý sloupec má u starých řádků NULL, filtr na prázdné pole je
   * nechytil) a lidem zmizely odkazy z lišty. Cenou je, že odškrtnutím
   * úplně všeho se člověk nezamkne ven; na to je vypnutí účtu.
   */
  const platny = seznam.length > 0 ? seznam : (VYCHOZI_PRISTUPY[String(kdo.role)] ?? []);
  if (platny.includes(klic)) return true;

  const sekce = sekcePrava(klic);
  if (!sekce) return false;

  // Celá sekce bez jediného upřesnění = všechna její práva (účty založené
  // před rozpadem na detaily, a taky „dej mu Doklady celé").
  if (klic !== sekce && platny.includes(sekce)) {
    return !pravaSekce(sekce).some((p) => platny.includes(p));
  }
  // Naopak: kdo má jen některá práva sekce, do sekce samotné patří.
  if (klic === sekce) return pravaSekce(sekce).some((p) => platny.includes(p));
  return false;
}

/**
 * Do kterého klíče cesta patří - nebo null, když se zaškrtávátky neřídí.
 * Delší cesta vyhrává: `/admin/doklady/faktury` patří právu na faktury,
 * i když `/admin/doklady` patří celé sekci.
 */
export function sekceCesty(href: string): string | null {
  const cesta = href.split('?')[0];
  let nalezena: { klic: string; delka: number } | null = null;
  for (const { cesta: vzor, klic } of CESTY_SEKCI) {
    if (cesta === vzor || cesta.startsWith(`${vzor}/`)) {
      if (!nalezena || vzor.length > nalezena.delka) nalezena = { klic, delka: vzor.length };
    }
  }
  return nalezena?.klic ?? null;
}

export function nazevSekce(klic: string): string {
  const sekce = PODLE_KLICE.get(klic as KlicSekce);
  if (sekce) return sekce.nazev;
  const zaklad = sekcePrava(klic);
  const pravo = zaklad ? PODLE_KLICE.get(zaklad)?.prava.find((p) => p.klic === klic) : null;
  return pravo?.nazev ?? klic;
}

/** Vyčistí, co přišlo z formuláře - neznámé klíče zahodí. */
export function pouzeZnameSekce(klice: string[]): string[] {
  const zname = new Set<string>();
  for (const s of SEKCE) {
    zname.add(s.klic);
    for (const p of s.prava) zname.add(p.klic);
  }
  return [...zname].filter((k) => klice.includes(k));
}
