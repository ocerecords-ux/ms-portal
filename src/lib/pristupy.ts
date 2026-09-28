import type { Role } from '@prisma/client';

/**
 * PŘÍSTUPY DO SEKCÍ PODLE ZAŠKRTÁVÁTEK (zadání 28. 9. 2026: „potřeboval bych
 * postupně předělat tu sekci, kde rozkliknu já jako superadmin uživatele
 * a tam mu pomocí zaškrtávacích polí dávám přístup jednotlivým sekcím").
 *
 * DO TEĎ ROZHODOVALA ROLE. Zvukař viděl, co vidí zvukaři, a nedalo se to
 * posunout - kdo měl vidět Doklady, musel být Žůžo-labůžo se vším všudy.
 * Od téhle chvíle rozhoduje u devíti sekcí níž seznam na kartě uživatele
 * (`User.pristupy`) a role je jen VÝCHOZÍ SADA, která se předvyplní.
 *
 * TŘI PRAVIDLA, KTERÁ SE NESMÍ ROZEJÍT:
 *
 *  1. SUPERADMIN VIDÍ VŠECHNO. Zaškrtávátka se u něj neřeší a jako jediný je
 *     rozdává. Bez téhle pojistky by se dal poslední správce zamknout ze
 *     správy uživatelů a nikdo by se tam už nedostal.
 *  2. ZAŠKRTÁVÁTKA JSOU JEN PRO NÁŠ TÝM. Klient, herec, tabule a klient
 *     studia mají vlastní úzký portál (Objednávka, Nahrávky, Moje termíny,
 *     Honoráře) a ten se tímhle neřídí - viz `podlehaPristupum`.
 *  3. CO TU NENÍ, ŘÍDÍ SE DÁL ROLÍ. Výkazy, honoráře, nápověda, můj účet -
 *     ty se zaškrtávátky nerozdávají a PAGE_ACCESS u nich platí beze změny.
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

export type Sekce = {
  klic: KlicSekce;
  nazev: string;
  /** Jedna věta k zaškrtávátku - co člověk uvidí, když mu to dáš. */
  popis: string;
  /**
   * Cesty, které sekce otevírá. Bere se i všechno pod nimi, takže
   * `/admin/doklady` pustí i `/admin/doklady/faktury/123`.
   */
  cesty: string[];
};

export const SEKCE: Sekce[] = [
  {
    klic: 'PROJEKTY',
    nazev: 'Projekty',
    popis: 'Seznam projektů a jejich detail - stav, herci, termíny, výstupy.',
    cesty: ['/projekty'],
  },
  {
    klic: 'DOKLADY',
    nazev: 'Doklady',
    popis: 'Nabídky, faktury, výdaje a moje firmy. Jsou tam peníze celé firmy.',
    cesty: ['/admin/doklady'],
  },
  {
    klic: 'PREHLEDY',
    nazev: 'Přehledy',
    popis: 'Kapacita studií, backlog, obrat a zisk, knihy a rozpočty.',
    cesty: ['/prehledy', '/backlog'],
  },
  {
    klic: 'KALENDARE',
    nazev: 'Kalendáře',
    popis: 'Kalendáře studií - natáčení, střihy, blokace a nepřítomnosti.',
    cesty: ['/kalendar'],
  },
  {
    klic: 'STUDIA',
    nazev: 'Studia',
    popis: 'Nastavení studií, rezervační kalendář a ceník studia.',
    cesty: ['/studio', '/admin/studia', '/cenik-studia'],
  },
  {
    klic: 'FIRMY',
    nazev: 'Firmy',
    popis: 'Klienti a dodavatelé - karty firem, sazby a kontakty.',
    cesty: ['/admin', '/admin/companies'],
  },
  {
    klic: 'ZPRAVY_PORTALU',
    nazev: 'Zprávy z portálu',
    popis: 'Vzory zpráv, které portál posílá ven, a hlášky v rozhraní.',
    cesty: ['/admin/zpravy-portalu', '/admin/vzory-zprav'],
  },
  {
    klic: 'HERCI',
    nazev: 'Herci',
    popis: 'Karty herců, pozvánky a jejich údaje.',
    cesty: ['/pozvanky'],
  },
  {
    klic: 'KLIENTI',
    nazev: 'Klienti',
    popis: 'Karty klientských účtů a jejich nastavení.',
    cesty: [],
  },
];

const PODLE_KLICE = new Map(SEKCE.map((s) => [s.klic, s]));

/** Všechny cesty, o kterých rozhodují zaškrtávátka - ostatní zůstávají na roli. */
export const CESTY_SEKCI: { cesta: string; klic: KlicSekce }[] = SEKCE.flatMap((s) =>
  s.cesty.map((cesta) => ({ cesta, klic: s.klic })),
);

/**
 * VÝCHOZÍ SADA PODLE ROLE. Tohle NENÍ pravidlo přístupu - je to jen to, co se
 * předvyplní novému člověku a co se jednorázově doplnilo stávajícím účtům,
 * aby se jim nic neztratilo. Sedí s tím, co která role viděla do 28. 9. 2026.
 */
export const VYCHOZI_PRISTUPY: Record<string, KlicSekce[]> = {
  ADMIN: [
    'PROJEKTY',
    'DOKLADY',
    'PREHLEDY',
    'KALENDARE',
    'STUDIA',
    'FIRMY',
    'ZPRAVY_PORTALU',
    'HERCI',
    'KLIENTI',
  ],
  PRODUKCE: ['PROJEKTY', 'PREHLEDY', 'KALENDARE', 'STUDIA', 'HERCI'],
  ZVUKAR: ['PROJEKTY', 'KALENDARE', 'STUDIA'],
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
 * Smí tenhle člověk do téhle sekce?
 *
 * Superadmin všude. Kdo se zaškrtávátky neřídí (klient, herec, tabule, klient
 * studia), tomu tahle funkce neodpovídá - o něm rozhoduje dál role, takže
 * vrací `false` a volající se ptá jinak.
 */
export function maPristup(kdo: KdoPristupy, klic: KlicSekce): boolean {
  if (kdo.superadmin) return true;
  if (!podlehaPristupum(kdo.role)) return false;
  const seznam = kdo.pristupy ?? [];
  /**
   * PRÁZDNÝ SEZNAM ZNAMENÁ „JEŠTĚ NENASTAVENO", NE „NIKAM NESMÍ".
   *
   * Pojistka z 28. 9. 2026: první doplnění stávajícím účtům neproběhlo
   * (čerstvý sloupec má u starých řádků NULL, filtr na prázdné pole je
   * nechytil) a lidem zmizely odkazy z lišty. Když je seznam prázdný,
   * platí výchozí sada podle role - stejná, jakou má člověk dostat.
   *
   * Cenou je, že odškrtnutím úplně všeho se člověk nezamkne ven; na to je
   * vypnutí účtu. To je lepší než tichý výpadek pro celý tým.
   */
  if (seznam.length === 0) return (VYCHOZI_PRISTUPY[String(kdo.role)] ?? []).includes(klic);
  return seznam.includes(klic);
}

/**
 * Do které sekce cesta patří - nebo null, když se zaškrtávátky neřídí.
 * Delší cesta vyhrává: `/admin/studia` patří Studiím, i když `/admin` patří
 * Firmám.
 */
export function sekceCesty(href: string): KlicSekce | null {
  const cesta = href.split('?')[0];
  let nalezena: { klic: KlicSekce; delka: number } | null = null;
  for (const { cesta: vzor, klic } of CESTY_SEKCI) {
    if (cesta === vzor || cesta.startsWith(`${vzor}/`)) {
      if (!nalezena || vzor.length > nalezena.delka) nalezena = { klic, delka: vzor.length };
    }
  }
  return nalezena?.klic ?? null;
}

export function nazevSekce(klic: KlicSekce): string {
  return PODLE_KLICE.get(klic)?.nazev ?? klic;
}

/** Vyčistí, co přišlo z formuláře - neznámé klíče zahodí. */
export function pouzeZnameSekce(klice: string[]): KlicSekce[] {
  return SEKCE.map((s) => s.klic).filter((k) => klice.includes(k));
}
