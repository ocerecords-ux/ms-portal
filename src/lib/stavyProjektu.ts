/**
 * Stavy projektu (zadání 10. 9. 2026 — cesta projektu „Natáčení a postprodukce
 * audioknihy").
 *
 * Do teď stav přicházel z Caflou a portál ho jen ukazoval. Mediaspace ale
 * Caflou opouští, takže od téhle chvíle je stav VLASTNÍ ÚDAJ PORTÁLU a přehazuje
 * se ručně (některé přechody později automaticky — viz níž).
 *
 * POŘADÍ NENÍ NÁHODNÉ: seznam jde tak, jak projekt opravdu putuje, aby se
 * v nabídce hledal ten správný stav a ne aby se lovil v abecedě.
 *
 * Co je zatím ruční a co poběží samo:
 *   - „Dotočeno" se má překlopit samo, jakmile je s hercem dotočeno a na disku
 *     ještě není ani jeden track.
 *   - „Čekáme na opravy" se má překlopit samo sedm dní po „Dokončeno -
 *     ke schválení" a odejít o tom zpráva klientovi.
 * Obojí čeká na napojení na disk a na nastavení notifikací u firmy; do té doby
 * jde přehodit obojí ručně, aby to nikoho neblokovalo.
 */

export type StavProjektu = {
  /** Přesně ten text, který se ukládá a ukazuje. */
  nazev: string;
  /** Jednou větou, kdy se do stavu přechází — vysvětlivka u nabídky. */
  popis: string;
  /** Rozpracovaný projekt = patří do záložky Aktivní. */
  rozpracovany: boolean;
  /** Třídy odznaku - podklad, text a rámeček. Viz poznámka k barvám níž. */
  barva: string;
};

/*
 * BARVY STAVŮ (zadání 10. 9. 2026)
 *
 * Šest barev je zadaných napevno:
 *   V přípravě               šedá
 *   Natáčíme                 světle modrá
 *   Natáčíme/stříháme        žlutá
 *   Dokončeno - ke schválení zelená
 *   Čekáme na opravy         fialová
 *   Schváleno - k fakturaci  červená
 *
 * Zbylé dva stavy v zadání nebyly. Jsou to dvojčata dvou jmenovaných
 * („Dotočeno" k „Natáčíme", „Dotočeno/stříháme" k „Natáčíme/stříháme"), takže
 * dostaly sousední odstín téže rodiny - modrozelenou a oranžovou. Stejnou
 * barvu jako jejich dvojče schválně nemají: dva stavy, které vypadají
 * totožně, nejdou v seznamu rozeznat.
 *
 * Odstíny jsou schválně napsané číselně (slate-100 a spol.), ne přes tokeny
 * portálu: token okTint/warnTint jsou jen tři a stavů je osm, takže by se
 * půlka z nich slila dohromady. Ke každé barvě je varianta pro tmavý režim -
 * světlý podklad by v noci svítil jako lampa.
 *
 * Rámeček má každý odznak proto, aby se stavy daly rozlišit i tehdy, když si
 * někdo obrazovku vytiskne černobíle nebo barvy nerozezná.
 */

export const STAVY_PROJEKTU: StavProjektu[] = [
  {
    nazev: 'V přípravě',
    popis: 'Objednávka přišla, projekt je založený, ještě se neplánuje.',
    rozpracovany: true,
    barva:
      'bg-slate-100 text-slate-700 border border-slate-300 dark:bg-slate-500/20 dark:text-slate-200 dark:border-slate-400/40',
  },
  {
    nazev: 'Natáčíme',
    popis: 'S hercem je naplánováno.',
    rozpracovany: true,
    barva:
      'bg-sky-100 text-sky-800 border border-sky-300 dark:bg-sky-500/20 dark:text-sky-200 dark:border-sky-400/40',
  },
  {
    nazev: 'Natáčíme/stříháme',
    popis: 'Ještě se natáčí a na disku už jsou první zpracované tracky k poslechu.',
    rozpracovany: true,
    barva:
      'bg-yellow-100 text-yellow-800 border border-yellow-300 dark:bg-yellow-500/20 dark:text-yellow-100 dark:border-yellow-400/40',
  },
  {
    nazev: 'Dotočeno',
    popis: 'S hercem dotočeno, na disku zatím není ani jeden track.',
    rozpracovany: true,
    barva:
      'bg-cyan-100 text-cyan-800 border border-cyan-300 dark:bg-cyan-500/20 dark:text-cyan-200 dark:border-cyan-400/40',
  },
  {
    nazev: 'Dotočeno/stříháme',
    popis: 'S hercem dotočeno a na disku už jsou první tracky.',
    rozpracovany: true,
    barva:
      'bg-orange-100 text-orange-800 border border-orange-300 dark:bg-orange-500/20 dark:text-orange-100 dark:border-orange-400/40',
  },
  {
    nazev: 'Dokončeno - ke schválení',
    popis: 'Na disku jsou všechny tracky, čekáme na finální opravy od klienta.',
    rozpracovany: true,
    barva:
      'bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-200 dark:border-emerald-400/40',
  },
  {
    nazev: 'Čekáme na opravy',
    popis: 'Sedm dní po odevzdání klient opravy nedodal.',
    rozpracovany: true,
    barva:
      'bg-violet-100 text-violet-800 border border-violet-300 dark:bg-violet-500/20 dark:text-violet-200 dark:border-violet-400/40',
  },
  {
    nazev: 'Schváleno - k fakturaci',
    popis: 'Opravené nahrávky jsou na disku, projekt je hotový.',
    rozpracovany: false,
    barva:
      'bg-red-100 text-red-800 border border-red-300 dark:bg-red-500/20 dark:text-red-200 dark:border-red-400/40',
  },
];

const NAZVY = STAVY_PROJEKTU.map((s) => s.nazev);

/** Je to stav z naší cesty projektu? Staré stavy z Caflou tu být nemusí. */
export function jeNasStav(nazev: string | null | undefined): boolean {
  return Boolean(nazev) && NAZVY.includes(nazev as string);
}

/**
 * Je projekt v tomhle stavu dokončený?
 *
 * Rozhoduje jen náš seznam. Stav, který v něm není (přenesený z Caflou),
 * se tímhle neřídí — o tom rozhoduje příznak `finished` u projektu.
 */
export function stavJeDokonceny(nazev: string | null | undefined): boolean | null {
  const stav = STAVY_PROJEKTU.find((s) => s.nazev === nazev);
  return stav ? !stav.rozpracovany : null;
}

export function popisStavu(nazev: string | null | undefined): string | null {
  return STAVY_PROJEKTU.find((s) => s.nazev === nazev)?.popis ?? null;
}

/** Zaloha pro stavy, ktere v nasi ceste nejsou (prenesene z Caflou). */
const BARVA_DOKONCENY =
  'bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-200 dark:border-emerald-400/40';
const BARVA_ROZPRACOVANY =
  'bg-slate-100 text-slate-700 border border-slate-300 dark:bg-slate-500/20 dark:text-slate-200 dark:border-slate-400/40';

/**
 * Třídy odznaku pro daný stav.
 *
 * Stav z naší cesty má svou barvu. Cokoliv jiného (starý stav přenesený
 * z Caflou) dostane neutrální šedou, nebo zelenou, když je projekt dokončený -
 * ať odznak nikdy nevypadá rozbitě.
 */
export function barvaStavu(nazev: string | null | undefined, dokonceny = false): string {
  const stav = STAVY_PROJEKTU.find((s) => s.nazev === nazev);
  if (stav) return stav.barva;
  return dokonceny ? BARVA_DOKONCENY : BARVA_ROZPRACOVANY;
}
