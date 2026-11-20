/**
 * EMA PIAROVÁ - čistá část (zadání 19. 11. 2026).
 *
 * Ema je naše agentka pro PR a komunikaci. V portálu má vlastní sekci:
 * kampaně, v nich zadání a její výstupy, a seznam médií se stavem.
 *
 * Soubor je BEZ PRISMY a bez volání ven, aby ho mohla vzít i obrazovka
 * v prohlížeči - stejně jako lib/tracklist.ts. Všechno, co sahá do databáze
 * nebo na Anthropic, je v lib/emaServer.ts a lib/emaAgent.ts.
 */

export const STAVY_KAMPANE = ['ROZPRACOVANA', 'BEZI', 'HOTOVA', 'ODLOZENA'] as const;
export type StavKampane = (typeof STAVY_KAMPANE)[number];

export const STAVY_UKOLU = ['CEKA', 'BEZI', 'HOTOVO', 'CHYBA'] as const;
export type StavUkolu = (typeof STAVY_UKOLU)[number];

export const DRUHY_MEDIA = ['PODCAST', 'TV', 'RADIO', 'TISK', 'WEB', 'JINE'] as const;
export type DruhMedia = (typeof DRUHY_MEDIA)[number];

/**
 * STAV U MÉDIA je cesta od nápadu k výsledku. Portál nic sám neodesílá -
 * „nabídnuto" se odškrtne, až to člověk opravdu pošle (19. 11. 2026).
 */
export const STAVY_MEDIA = ['NAVRH', 'NABIDNUTO', 'ODPOVEDELI', 'VYSLO', 'ODMITNUTO'] as const;
export type StavMedia = (typeof STAVY_MEDIA)[number];

/** Barva odznaku u stavu média - stejná logika jako u stavů projektu. */
export const BARVA_STAVU_MEDIA: Record<StavMedia, string> = {
  NAVRH: '#9ca3af',
  NABIDNUTO: '#7B55FF',
  ODPOVEDELI: '#f59e0b',
  VYSLO: '#1FDF67',
  ODMITNUTO: '#ef4444',
};

export type Kampan = {
  id: string;
  nazev: string;
  brief: string | null;
  stav: StavKampane;
  caflouProjectId: string | null;
  /** Hromadná předloha mailu pro celou kampaň (20. 11. 2026). */
  predmetMailu: string | null;
  textMailu: string | null;
  createdAt: string;
  pocetUkolu: number;
  pocetMedii: number;
  pocetOdeslanych: number;
};

export type Ukol = {
  id: string;
  zadani: string;
  stav: StavUkolu;
  vystup: string | null;
  chyba: string | null;
  kroky: string[];
  hledani: number;
  zadalJmeno: string | null;
  createdAt: string;
  hotovoAt: string | null;
};

export type Medium = {
  id: string;
  nazev: string;
  druh: DruhMedia;
  kontakt: string | null;
  odkaz: string | null;
  duvod: string | null;
  overeno: boolean;
  stav: StavMedia;
  predmet: string | null;
  textMailu: string | null;
  /** Mail čeká ve frontě a odejde v tuhle dobu (20. 11. 2026, proti spamu). */
  odeslatAt: string | null;
  odeslanoAt: string | null;
  poznamka: string | null;
};

/** Běží úkol, nebo čeká? Podle toho se obrazovka ptá na stav dokola. */
export function jeVPohybu(stav: StavUkolu): boolean {
  return stav === 'CEKA' || stav === 'BEZI';
}
