import type { Role } from '@prisma/client';

/**
 * NÁHLEDOVÝ ÚČET - PORTÁL NA ZKOUŠKU (zadání 18. 9. 2026: „vytvoř mi ještě
 * jeden profil pro uživatele, který nemůže nic měnit, jen si může vyzkoušet
 * celý portál z různých rolí. Herec, Tým, Klient").
 *
 * PROČ PŘÍZNAK U ÚČTU A NE NOVÁ ROLE. Celý portál se rozhoduje podle role -
 * `isInternalRole`, `canEditProjectMeta`, `PAGE_ACCESS`, kalendáře, výkazy.
 * Nová role „NÁHLED" by znamenala doplnit ji do každého toho seznamu a u
 * každého se rozhodnout, co smí vidět - a hlavně bychom pak ukazovali něco
 * jiného, než co vidí skutečný klient nebo herec. Takhle si účet PŮJČUJE
 * existující roli a portál se chová přesně tak, jak se chová jim.
 *
 * NIC NEMĚNÍ. Zámek nestojí v jednotlivých obrazovkách (těch jsou stovky),
 * ale v middleware.ts: z náhledového účtu neprojde žádný požadavek, který
 * něco zapisuje (POST, PATCH, PUT, DELETE). Jediná výjimka je přihlášení a
 * odhlášení. I kdyby se tedy tlačítko někde ukázalo, uložit nic nedokáže.
 *
 * KTEROU ROLI SI PŮJČÍ, se drží v cookie prohlížeče - přepínač v liště ji
 * přepíše a stránka se načte znovu. Cookie sama o sobě nic neotevírá:
 * uplatní se jedině u účtu, který má `jenNahled`, a jen na tyhle tři
 * hodnoty. Žůžo-labůžo mezi nimi schválně není - administrace jsou doklady,
 * banka a osobní údaje lidí, a to není nic „na vyzkoušení". Tým se proto
 * půjčuje jako Produkce, což je největší rozsah, který dává smysl ukazovat.
 */

/** Jméno cookie s vybraným pohledem. Čte ji server (viz lib/auth.ts). */
export const NAHLED_COOKIE = 'ms-nahled';

export type NahledVolba = 'tym' | 'klient' | 'herec';

export type NahledPohled = {
  volba: NahledVolba;
  popisek: string;
  /** Roli, kterou si účet v tomhle pohledu půjčuje. */
  role: Role;
  /**
   * Má se použít firma z účtu? Klient bez firmy by viděl prázdný seznam,
   * herec a tým naopak firmu mít nesmí - interní účet ji nemá žádnou.
   */
  sVlastniFirmou: boolean;
  vysvetleni: string;
};

export const NAHLED_POHLEDY: NahledPohled[] = [
  {
    volba: 'tym',
    popisek: 'Tým',
    role: 'PRODUKCE',
    sVlastniFirmou: false,
    vysvetleni: 'projekty napříč firmami, kalendář, pozvánky - jako produkce',
  },
  {
    volba: 'klient',
    popisek: 'Klient',
    role: 'CLIENT',
    sVlastniFirmou: true,
    vysvetleni: 'jen zakázky své firmy, objednávka a nahrávky',
  },
  {
    volba: 'herec',
    popisek: 'Herec',
    role: 'HEREC',
    sVlastniFirmou: false,
    vysvetleni: 'moje termíny a nabídky natáčení',
  },
];

export const VYCHOZI_NAHLED: NahledVolba = 'tym';

/** Z hodnoty v cookie udělá platnou volbu - cokoliv jiného spadne na výchozí. */
export function nahledZHodnoty(hodnota?: string | null): NahledVolba {
  const nalezeno = NAHLED_POHLEDY.find((p) => p.volba === hodnota);
  return nalezeno ? nalezeno.volba : VYCHOZI_NAHLED;
}

export function pohledNahledu(volba: NahledVolba): NahledPohled {
  return NAHLED_POHLEDY.find((p) => p.volba === volba) ?? NAHLED_POHLEDY[0];
}

/**
 * Co uvidí člověk, který se z náhledového účtu pokusí něco uložit. Píše se
 * na jednom místě, ať je to v celém portálu stejnou větou - hlášku vypisují
 * formuláře samy z odpovědi serveru.
 */
export const ZPRAVA_JEN_NAHLED =
  'Tenhle účet je jen na prohlížení portálu - nic se z něj neuloží.';
