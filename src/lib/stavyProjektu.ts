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
 *   Plánujeme                indigová (přibylo 24. 9. 2026 - mezi přípravou
 *                            a natáčením; sousedí s modrou, ale je sytější)
 *   Natáčíme                 světle modrá
 *   Natáčíme/stříháme        žlutá
 *   Dokončeno - ke schválení zelená
 *   Čekáme na opravy         fialová
 *   Schváleno - k fakturaci  červená
 *   Vyfakturováno            zelená (přibylo 15. 9. 2026 - projekt končí až fakturou)
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
    /**
     * PLÁNUJEME (zadání 24. 9. 2026: „ten bude sloužit pro to, aby Helča
     * věděla, že už může plánovat s herci termíny, že je odsouhlasena cena
     * apod.").
     *
     * Je to předěl mezi obchodem a výrobou: do téhle chvíle se domlouvá cena
     * a rozsah, od téhle chvíle se obsazuje studio. Proto o něm jako
     * o jediném stavu cinkne zvonek - viz zvonekOPlanovani v lib/planovani.ts.
     */
    nazev: 'Plánujeme',
    popis: 'Cena je odsouhlasená, můžou se domlouvat termíny s herci.',
    rozpracovany: true,
    barva:
      'bg-indigo-100 text-indigo-800 border border-indigo-300 dark:bg-indigo-500/20 dark:text-indigo-200 dark:border-indigo-400/40',
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
    // Zadani 15. 9. 2026: „projekt by se nemel ukoncit prehozenim stavu na
    // Schvaleno - k fakturaci. Ukoncit by se mel az ve chvili, kdy odesleme
    // fakturu na klienta." Prace na projektu tedy skoncila, ale zakazka bezi
    // dal - proto rozpracovany.
    popis: 'Opravené nahrávky jsou na disku, čeká se na fakturu.',
    rozpracovany: true,
    barva:
      'bg-red-100 text-red-800 border border-red-300 dark:bg-red-500/20 dark:text-red-200 dark:border-red-400/40',
  },
  {
    nazev: 'Vyfakturováno',
    popis: 'Faktura je u klienta — projekt je uzavřený.',
    rozpracovany: false,
    barva:
      'bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-200 dark:border-emerald-400/40',
  },
];

const NAZVY = STAVY_PROJEKTU.map((s) => s.nazev);

/**
 * STAVY U REKLAMY (zadání 18. 9. 2026: „u reklam by měly být vidět jen stavy:
 * V přípravě, Natáčíme, Dokončeno - ke schválení, Schváleno - k fakturaci").
 *
 * Spot se nenatáčí a nestříhá týdny a nečeká se u něj na opravy po částech -
 * cesta je krátká. Zbylé stavy jsou z audioknižního světa a v nabídce jen
 * pletly.
 */
const STAVY_REKLAMY = [
  'V přípravě',
  // Plánujeme patří i k reklamě - termín s hercem se domlouvá stejně
  // (24. 9. 2026).
  'Plánujeme',
  'Natáčíme',
  'Dokončeno - ke schválení',
  'Schváleno - k fakturaci',
];

/**
 * Které stavy nabídnout. U reklamní firmy užší výběr, jinak všechny.
 *
 * Stav, který projekt UŽ MÁ, se nabízí vždycky - i kdyby do výběru nepatřil.
 * Jinak by se u starého projektu nedal přepnout na nic (nabídka by neobsahovala
 * jeho vlastní hodnotu) a vypadalo by to jako chyba.
 */
export function stavyProFirmu(jeReklama: boolean, aktualni?: string | null): StavProjektu[] {
  if (!jeReklama) return STAVY_PROJEKTU;
  const vybrane = STAVY_PROJEKTU.filter((s) => STAVY_REKLAMY.includes(s.nazev));
  const stav = aktualni?.trim();
  if (stav && !vybrane.some((s) => s.nazev === stav)) {
    const chybejici = STAVY_PROJEKTU.find((s) => s.nazev === stav);
    if (chybejici) return [...vybrane, chybejici];
  }
  return vybrane;
}

/**
 * Od kterého stavu je práce odevzdaná (zadání 18. 9. 2026: „když se překlopí
 * nebo bude stav na Dokončeno - ke schválení, tak se datum změní třeba na
 * bílou, protože byl odevzdán v termínu").
 *
 * Bere se pořadí, ne jedno jméno: po odevzdání jde projekt ještě přes
 * „Čekáme na opravy", „Schváleno - k fakturaci" a „Vyfakturováno" - a v žádném
 * z nich už termín dokončení nemá co hlídat.
 */
const PRVNI_ODEVZDANY = NAZVY.indexOf('Dokončeno - ke schválení');

export function stavJeOdevzdany(nazev: string | null | undefined): boolean {
  const index = NAZVY.indexOf((nazev ?? '') as string);
  return index >= 0 && PRVNI_ODEVZDANY >= 0 && index >= PRVNI_ODEVZDANY;
}

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

/**
 * Je projekt teprve v přípravě? Stav se porovnává s prvním krokem cesty, ne
 * s napsaným řetězcem - kdyby se stav jednou přejmenoval, drží to dál.
 */
export function jeVPriprave(statusName: string | null | undefined): boolean {
  return (statusName ?? '').trim() === STAVY_PROJEKTU[0].nazev;
}

/**
 * Stav, ve kterém se domlouvají termíny (zadání 24. 9. 2026). Drží se jedním
 * místem, ať se název nepíše po kódu podruhé.
 */
export const STAV_PLANUJEME = 'Plánujeme';
