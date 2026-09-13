/**
 * Jazyk portálu (zadání 13. 9. 2026: „přidej celkově na portálu přepnutí
 * jazyka do britské angličtiny").
 *
 * PROČ TAKHLE A NE KNIHOVNOU: portál má 155 obrazovek a texty jsou v nich
 * napsané natvrdo. Přepisovat je najednou na knihovnu (next-intl a spol.) by
 * znamenalo sáhnout do všeho naráz. Tenhle slovník se dá plnit po částech -
 * co v něm ještě není, zůstane česky a portál funguje dál.
 *
 * ANGLIČTINA JE BRITSKÁ. Tedy „organise", „authorise", datum 13/09/2026 a
 * libra jako £. Klienti MS Studio London jsou Britové.
 *
 * Jazyk se drží v cookie (KLIC_JAZYKA), takže ho zná i server a stránka
 * přijde rovnou v tom správném jazyce - žádné přeblikávání po načtení.
 */

export type Jazyk = 'cs' | 'en';

export const JAZYKY: Jazyk[] = ['cs', 'en'];
export const KLIC_JAZYKA = 'msportal_jazyk';
/** Rok - jazyk je volba, ne relace. */
export const PLATNOST_JAZYKA_S = 60 * 60 * 24 * 365;

export function jeJazyk(hodnota: unknown): hodnota is Jazyk {
  return hodnota === 'cs' || hodnota === 'en';
}

/** Kód pro Intl a atribut lang - britská angličtina, ne americká. */
export function kodJazyka(jazyk: Jazyk): 'cs-CZ' | 'en-GB' {
  return jazyk === 'en' ? 'en-GB' : 'cs-CZ';
}

/**
 * Názvy stránek v liště. Klíčem je adresa, ne text - lišta je u každého
 * uživatele vlastní a uložená v databázi česky, takže překládat se musí
 * podle toho, KAM odkaz vede.
 */
const ODKAZY_EN: Record<string, string> = {
  '/projekty': 'Projects',
  '/objednavka': 'New order',
  '/nahravky': 'Recordings',
  '/vykazy': 'Timesheets',
  '/kalendar': 'Calendar',
  '/moje-terminy': 'My sessions',
  '/muj-ucet': 'My account',
  '/admin': 'Companies',
  '/admin/users': 'Users',
  '/admin/ceniky': 'Price lists',
  '/admin/studia': 'Studios',
  '/admin/doklady': 'Invoicing',
  '/admin/archiv': 'Archive',
  '/admin/vzory-zprav': 'Message templates',
  '/admin/caflou-firmy': 'Caflou companies',
  '/chat': 'Chat',
};

export function nazevOdkazu(jazyk: Jazyk, href: string, zaloha: string): string {
  if (jazyk === 'cs') return zaloha;
  return ODKAZY_EN[href] ?? zaloha;
}

/**
 * Slovník. Klíč je krátký a mluvící, česká věta je zdroj pravdy - kdyby
 * anglická chyběla, ukáže se česká a nikde nezůstane prázdné místo.
 */
export const SLOVNIK: Record<string, { cs: string; en: string }> = {
  // --- horní lišta a účet ---
  'listou.upravit': { cs: 'Upravit', en: 'Edit' },
  'listou.hotovo': { cs: 'Hotovo', en: 'Done' },
  'listou.pridat': { cs: 'Přidat odkaz', en: 'Add link' },
  'listou.odhlasit': { cs: 'Odhlásit se', en: 'Sign out' },
  'listou.mujUcet': { cs: 'Můj účet', en: 'My account' },
  'listou.jazyk': { cs: 'Jazyk', en: 'Language' },
  'listou.cestina': { cs: 'Čeština', en: 'Czech' },
  'listou.anglictina': { cs: 'Angličtina', en: 'English' },

  // --- přihlášení ---
  'prihlaseni.nadpis': { cs: 'Přihlášení', en: 'Sign in' },
  'prihlaseni.email': { cs: 'E-mail', en: 'Email' },
  'prihlaseni.heslo': { cs: 'Heslo', en: 'Password' },
  'prihlaseni.tlacitko': { cs: 'Přihlásit se', en: 'Sign in' },
  'prihlaseni.probiha': { cs: 'Přihlašuji…', en: 'Signing in…' },
  'prihlaseni.zapomenute': { cs: 'Zapomenuté heslo', en: 'Forgotten password' },
  'prihlaseni.spatneUdaje': { cs: 'Nesprávný e-mail nebo heslo.', en: 'Incorrect email or password.' },
  'prihlaseni.nacitam': { cs: 'Načítám portál…', en: 'Opening the portal…' },
  'prihlaseni.chybaServeru': {
    cs: 'Přihlášení selhalo kvůli chybě serveru. Zkuste to prosím znovu.',
    en: 'Sign-in failed because of a server error. Please try again.',
  },
  'prihlaseni.ucetZalozi': { cs: 'Účet vám založí Mediaspace.', en: 'Mediaspace will set up your account.' },

  // --- obecné ---
  'obecne.ulozit': { cs: 'Uložit', en: 'Save' },
  'obecne.zrusit': { cs: 'Zrušit', en: 'Cancel' },
  'obecne.smazat': { cs: 'Smazat', en: 'Delete' },
  'obecne.zavrit': { cs: 'Zavřít', en: 'Close' },
  'obecne.hledat': { cs: 'Hledat', en: 'Search' },
  'obecne.nacitam': { cs: 'Načítám…', en: 'Loading…' },
  'obecne.nicTuNeni': { cs: 'Tady zatím nic není.', en: 'Nothing here yet.' },
  'obecne.zpet': { cs: 'Zpět', en: 'Back' },
};

/** Přeloží klíč. Co ve slovníku není, projde česky - a je to vidět. */
export function prelozit(jazyk: Jazyk, klic: string): string {
  const zaznam = SLOVNIK[klic];
  if (!zaznam) {
    if (process.env.NODE_ENV !== 'production') console.warn(`Chybí překlad pro „${klic}".`);
    return klic;
  }
  return jazyk === 'en' ? zaznam.en || zaznam.cs : zaznam.cs;
}
