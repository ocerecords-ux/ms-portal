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

/**
 * KÓD STAVU (dávka 7e, 3. 10. 2026).
 *
 * Do databáze se dál ukládá ČESKÝ NÁZEV - `nazev` je pořád ta hodnota, která
 * leží v `ProjectMeta.statusName` i v historii projektu, a nic se v datech
 * nepřepisuje. Kód je navíc, odvozený z názvu, a slouží ke DVĚMA věcem:
 *
 *  1. PŘEKLADU. Název stavu se v angličtině bere ze slovníku podle kódu
 *     (`stav.<KOD>`), ne podle českého textu.
 *  2. POROVNÁVÁNÍ. Dokud se porovnávalo s napsaným řetězcem, byl každý takový
 *     test tikající bomba: jakmile by někdo stav přejmenoval nebo přeložil,
 *     podmínka tiše přestane platit (viz docs/preklad-portalu.md, dávka 5).
 *
 * Skutečná migrace - uložit do databáze rovnou kód - zůstává dál na stole;
 * tohle je ta polovina, která se dá udělat bez sáhnutí na data.
 */
import { prelozit, type Jazyk } from '@/lib/jazyk';

export type KodStavu =
  | 'V_PRIPRAVE'
  | 'PLANUJEME'
  | 'NATACIME'
  | 'NATACIME_STRIHAME'
  | 'DOTOCENO'
  | 'DOTOCENO_STRIHAME'
  | 'DOKONCENO_KE_SCHVALENI'
  | 'CEKAME_NA_OPRAVY'
  | 'OPRAVUJEME'
  | 'SCHVALENO_K_FAKTURACI'
  | 'VYFAKTUROVANO';

export type StavProjektu = {
  /** Kód stavu - podle něj se překládá i porovnává. */
  kod: KodStavu;
  /** Přesně ten text, který se UKLÁDÁ do databáze. */
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
    kod: 'V_PRIPRAVE',
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
    kod: 'PLANUJEME',
    nazev: 'Plánujeme',
    popis: 'Cena je odsouhlasená, můžou se domlouvat termíny s herci.',
    rozpracovany: true,
    barva:
      'bg-indigo-100 text-indigo-800 border border-indigo-300 dark:bg-indigo-500/20 dark:text-indigo-200 dark:border-indigo-400/40',
  },
  {
    kod: 'NATACIME',
    nazev: 'Natáčíme',
    popis: 'S hercem je naplánováno.',
    rozpracovany: true,
    barva:
      'bg-sky-100 text-sky-800 border border-sky-300 dark:bg-sky-500/20 dark:text-sky-200 dark:border-sky-400/40',
  },
  {
    kod: 'NATACIME_STRIHAME',
    nazev: 'Natáčíme/stříháme',
    popis: 'Ještě se natáčí a na disku už jsou první zpracované tracky k poslechu.',
    rozpracovany: true,
    barva:
      'bg-yellow-100 text-yellow-800 border border-yellow-300 dark:bg-yellow-500/20 dark:text-yellow-100 dark:border-yellow-400/40',
  },
  {
    kod: 'DOTOCENO',
    nazev: 'Dotočeno',
    popis: 'S hercem dotočeno, na disku zatím není ani jeden track.',
    rozpracovany: true,
    barva:
      'bg-cyan-100 text-cyan-800 border border-cyan-300 dark:bg-cyan-500/20 dark:text-cyan-200 dark:border-cyan-400/40',
  },
  {
    kod: 'DOTOCENO_STRIHAME',
    nazev: 'Dotočeno/stříháme',
    popis: 'S hercem dotočeno a na disku už jsou první tracky.',
    rozpracovany: true,
    barva:
      'bg-orange-100 text-orange-800 border border-orange-300 dark:bg-orange-500/20 dark:text-orange-100 dark:border-orange-400/40',
  },
  {
    kod: 'DOKONCENO_KE_SCHVALENI',
    nazev: 'Dokončeno - ke schválení',
    popis: 'Na disku jsou všechny tracky, čekáme na finální opravy od klienta.',
    rozpracovany: true,
    barva:
      'bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-200 dark:border-emerald-400/40',
  },
  {
    kod: 'CEKAME_NA_OPRAVY',
    nazev: 'Čekáme na opravy',
    popis: 'Sedm dní po odevzdání klient opravy nedodal.',
    rozpracovany: true,
    barva:
      'bg-violet-100 text-violet-800 border border-violet-300 dark:bg-violet-500/20 dark:text-violet-200 dark:border-violet-400/40',
  },
  {
    /**
     * OPRAVUJEME (zadání 27. 9. 2026: „když se označí v AudioTaggeru přeposlech
     * jako dokončený, tak už by se neměly odesílat upomínky čekáme na opravy.
     * Ale vytvořil bych pro to nový stav, do kterého by se to překlopilo:
     * Opravujeme. V tomto stavu nejdou žádné notifikace").
     *
     * Míč je na naší straně: klient přeposlech dokončil, připomínky poslal
     * a my je zapracováváme. Proto odsud NEODCHÁZÍ klientovi ani jedna zpráva
     * - viz jeStavBezNotifikaci níž - a projekt přestane spadat pod denní
     * překlápění na „Čekáme na opravy", protože v tom stavu už není.
     */
    kod: 'OPRAVUJEME',
    nazev: 'Opravujeme',
    popis: 'Klient dokončil přeposlech, zapracováváme jeho připomínky. Klientovi odsud nic nechodí.',
    rozpracovany: true,
    /**
     * VÝRAZNÁ BARVA (zadání 28. 9. 2026: „změň barvu stavu Opravujeme na
     * nějakou výraznější").
     *
     * Jako jediný stav má PLNOU výplň, ne bledou — a to schválně: mezi
     * deseti světlými odznaky je plný fuchsiový vidět na první pohled, což
     * u stavu, kde je míč na naší straně, dává smysl. Rozlišuje ho to
     * i ve chvíli, kdy někdo barvy nerozezná.
     *
     * Původní cyan se navíc bila s „Dotočeno", které cyan má taky.
     * Fuchsia je v paletě stavů volná; k sousednímu „Čekáme na opravy"
     * (violet) je dost horká, aby se ty dva kroky nepletly.
     *
     * fuchsia-700 s bílým textem má kontrast 6,3:1, tedy i na drobné písmo
     * s rezervou (WCAG AA chce 4,5:1).
     */
    barva:
      'bg-fuchsia-700 text-white border border-fuchsia-800 dark:bg-fuchsia-600 dark:text-white dark:border-fuchsia-400/60',
  },
  {
    kod: 'SCHVALENO_K_FAKTURACI',
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
    kod: 'VYFAKTUROVANO',
    nazev: 'Vyfakturováno',
    popis: 'Faktura je u klienta — projekt je uzavřený.',
    rozpracovany: false,
    barva:
      'bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-200 dark:border-emerald-400/40',
  },
];

const NAZVY = STAVY_PROJEKTU.map((s) => s.nazev);

/**
 * Kód stavu z toho, co je uložené v databázi. Stav, který v naší cestě není
 * (starý přenos z Caflou), kód nemá - a je to vidět.
 */
export function kodStavu(nazev: string | null | undefined): KodStavu | null {
  const stav = (nazev ?? '').trim();
  return STAVY_PROJEKTU.find((s) => s.nazev === stav)?.kod ?? null;
}

/**
 * Jak se stav JMENUJE NA OBRAZOVCE. Jazyk je NEPOVINNÝ (vzor nazevMeny
 * z dávky 4): bez něj se vrací česky, takže pošta, PDF i zápis do databáze
 * mluví dál česky. Cizí stav bez kódu projde tak, jak je.
 */
export function nazevStavu(nazev: string | null | undefined, jazyk?: Jazyk): string {
  const text = (nazev ?? '').trim();
  if (!jazyk || jazyk === 'cs') return text;
  const kod = kodStavu(text);
  return kod ? prelozit(jazyk, `stav.${kod}`) : text;
}

/**
 * STAVY U REKLAMY (zadání 18. 9. 2026: „u reklam by měly být vidět jen stavy:
 * V přípravě, Natáčíme, Dokončeno - ke schválení, Schváleno - k fakturaci").
 *
 * Spot se nenatáčí a nestříhá týdny a nečeká se u něj na opravy po částech -
 * cesta je krátká. Zbylé stavy jsou z audioknižního světa a v nabídce jen
 * pletly.
 */
const STAVY_REKLAMY: KodStavu[] = [
  'V_PRIPRAVE',
  // Plánujeme patří i k reklamě - termín s hercem se domlouvá stejně
  // (24. 9. 2026).
  'PLANUJEME',
  'NATACIME',
  'DOKONCENO_KE_SCHVALENI',
  'SCHVALENO_K_FAKTURACI',
];

/**
 * JAK SE STAV JMENUJE SMĚREM KE KLIENTOVI REKLAMY (zadání 25. 9. 2026:
 * „klienti reklam by měli vidět jen tyto stavy: V přípravě, Plánujeme,
 * Natáčíme, Dokončeno - ke schválení (tady bude svítit klientovi Ke
 * schválení), Schváleno - k fakturaci (tenhle a všechny následující stavy
 * budou pro klienta jen Dokončeno)").
 *
 * Naše kuchyně - fakturace, opravy, střih - do klientova přehledu nepatří.
 * Zajímá ho, jestli se připravuje, plánuje, točí, jestli má něco schválit,
 * a jestli je hotovo.
 *
 * Počítá se to podle POŘADÍ v cestě projektu, ne výčtem: až mezi stavy něco
 * přibude za „Schváleno - k fakturaci", spadne to pod „Dokončeno" samo.
 */
const STAV_HOTOVO_OD: KodStavu = 'SCHVALENO_K_FAKTURACI';
const KODY = STAVY_PROJEKTU.map((s) => s.kod);

export function stavProKlientaReklamy(nazev: string | null | undefined, jazyk?: Jazyk): string {
  const stav = (nazev ?? '').trim();
  if (!stav) return '';
  const kod = kodStavu(stav);
  if (kod === 'DOKONCENO_KE_SCHVALENI') return prelozit(jazyk ?? 'cs', 'stav.klient.keSchvaleni');

  const odkud = KODY.indexOf(STAV_HOTOVO_OD);
  const kde = kod ? KODY.indexOf(kod) : -1;
  // Stav, který v naší cestě není (starý přenos z Caflou), se nepřekřtívá -
  // vymyslet si u něj „Dokončeno" by mohlo lhát.
  if (odkud >= 0 && kde >= odkud) return prelozit(jazyk ?? 'cs', 'stav.klient.dokonceno');
  return nazevStavu(stav, jazyk);
}

/**
 * Které stavy nabídnout. U reklamní firmy užší výběr, jinak všechny.
 *
 * Stav, který projekt UŽ MÁ, se nabízí vždycky - i kdyby do výběru nepatřil.
 * Jinak by se u starého projektu nedal přepnout na nic (nabídka by neobsahovala
 * jeho vlastní hodnotu) a vypadalo by to jako chyba.
 */
export function stavyProFirmu(jeReklama: boolean, aktualni?: string | null): StavProjektu[] {
  if (!jeReklama) return STAVY_PROJEKTU;
  const vybrane = STAVY_PROJEKTU.filter((s) => STAVY_REKLAMY.includes(s.kod));
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
/**
 * Stav, kterým kniha poprvé odchází klientovi. Je to jméno na jednom místě,
 * protože se podle něj hledá i v historii projektu (`ProjektUdalost.nova`) -
 * viz lib/knihyPrehledServer.ts. Dva opisy téhož textu na dvou místech by se
 * rozešly při prvním přejmenování stavu.
 */
export const STAV_ODEVZDANO = 'Dokončeno - ke schválení';

const PRVNI_ODEVZDANY = KODY.indexOf('DOKONCENO_KE_SCHVALENI');

export function stavJeOdevzdany(nazev: string | null | undefined): boolean {
  const kod = kodStavu(nazev);
  const index = kod ? KODY.indexOf(kod) : -1;
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

export function popisStavu(nazev: string | null | undefined, jazyk?: Jazyk): string | null {
  const stav = STAVY_PROJEKTU.find((s) => s.nazev === nazev);
  if (!stav) return null;
  if (!jazyk || jazyk === 'cs') return stav.popis;
  return prelozit(jazyk, `stavPopis.${stav.kod}`);
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
  return kodStavu(statusName) === 'V_PRIPRAVE';
}

/**
 * Stav, ve kterém se domlouvají termíny (zadání 24. 9. 2026). Drží se jedním
 * místem, ať se název nepíše po kódu podruhé.
 */
export const STAV_PLANUJEME = 'Plánujeme';

/**
 * OPRAVUJEME - stav, ze kterého klientovi nic nechodí (zadání 27. 9. 2026:
 * „v tomto stavu nejdou žádné notifikace").
 *
 * Drží se tu jedním jménem, ať se po kódu nepíše podruhé. Kdo posílá klientovi
 * zprávu ke stavu nebo upomínku, se musí zeptat právě téhle funkce - v tomhle
 * stavu je práce na naší straně a klient už nemá co dodávat.
 */
export const STAV_OPRAVUJEME = 'Opravujeme';

export function jeStavBezNotifikaci(nazev: string | null | undefined): boolean {
  return kodStavu(nazev) === 'OPRAVUJEME';
}
