import type { Role } from '@prisma/client';

/**
 * Rychlé volby v levém panelu (zadání 9. 9. 2026: „vlevo bych chtěl skrývací
 * menu, podobně jako todo list. Budou tam rychlé volby. Měnitelné. Třeba Nová
 * objednávka, nová smlouva, nová faktura, nový projekt atd.").
 *
 * Nabídka je pevná v kódu — ikona i cíl patří k akci a nedávalo by smysl je
 * psát do databáze. Uživatel si volí jen TO, CO V PANELU JE, a v jakém pořadí
 * (model UserQuickAction), stejně jako u horní lišty.
 *
 * Kdo co uvidí se nenastavuje, řídí se to právy ke stránce — viz `roles` níže,
 * které odpovídá PAGE_ACCESS v lib/menu.ts.
 *
 * Soubor je bez přístupu do databáze, aby ho mohl použít i klientský panel.
 */

export type QuickActionKey =
  | 'objednavka'
  | 'projekt'
  | 'nabidka'
  | 'faktura'
  | 'smlouva'
  | 'vydaj'
  | 'termin'
  | 'vykaz'
  | 'uzivatel'
  | 'firma'
  | 'prehled-dne';

export type QuickAction = {
  key: QuickActionKey;
  label: string;
  /**
   * Kam volba vede. Adresa začínající „#" NIKAM NEVEDE - otevře něco rovnou
   * v portálu (viz `prehled-dne` níž). Panel to pozná a vykreslí místo
   * odkazu tlačítko.
   */
  href: string;
  /** Kdo tuhle akci smí vidět - musí odpovídat právům k cílové stránce. */
  roles: Role[];
};

const ADMIN: Role[] = ['ADMIN'];

export // Zkratka vede rovnou do editacniho okna, ne jen na stranku (zadani
// 9. 9. 2026: "jinak to jako rychla akce postrada smysl"). Zakladaci
// formulare nejsou samostatne stranky - sedi slozene pod tabulkou, takze
// adresa nese kotvu #nove a formular se pri otevreni stranky sam rozbali;
// viz lib/zkratky.ts.
//
// Bez kotvy zustavaji jen ty volby, kde uz cilova stranka JE formular
// (objednavka) nebo kde se zaklada jinak (termin v kalendari, vykaz).
const QUICK_ACTIONS: QuickAction[] = [
  { key: 'objednavka', label: 'Nová objednávka', href: '/objednavka', roles: ['CLIENT'] },
  // Zakladani projektu prislo s odchodem z Caflou (zadani 10. 9. 2026).
  { key: 'projekt', label: 'Nový projekt', href: '/projekty#nove', roles: ['ADMIN', 'PRODUKCE'] },
  { key: 'nabidka', label: 'Nová nabídka', href: '/admin/doklady/nabidky#nove', roles: ADMIN },
  { key: 'faktura', label: 'Nová faktura', href: '/admin/doklady/faktury#nove', roles: ADMIN },
  { key: 'smlouva', label: 'Nová smlouva', href: '/admin/doklady/smlouvy#nove', roles: ADMIN },
  { key: 'vydaj', label: 'Nový výdaj', href: '/admin/doklady/vydaje#nove', roles: ADMIN },
  { key: 'termin', label: 'Nový termín', href: '/kalendar', roles: ['ADMIN', 'PRODUKCE', 'ZVUKAR'] },
  { key: 'vykaz', label: 'Nový výkaz', href: '/vykazy', roles: ['ADMIN', 'ZVUKAR'] },
  { key: 'uzivatel', label: 'Nový uživatel', href: '/admin/users#nove', roles: ADMIN },
  { key: 'firma', label: 'Nová firma', href: '/admin#nove', roles: ADMIN },
  /**
   * CO MĚ DNES ČEKÁ (zadání 24. 9. 2026: „to okno, co mě dnes čeká, bych dal
   * do toho levého panelu s rychlýma volbama, ať se tam můžu během dne
   * jedním klikem kouknout").
   *
   * Jediná volba, která nikam nevede - otevře tytéž karty, co vyskočí ráno
   * (komponenta PrehledDne). Proto adresa „#prehled-dne": panel na ní pozná,
   * že má vykreslit tlačítko, ne odkaz.
   */
  {
    key: 'prehled-dne',
    label: 'Co mě dnes čeká',
    href: '#prehled-dne',
    roles: ['ADMIN', 'PRODUKCE', 'ZVUKAR'],
  },
];

/** Volba, která se neotevírá odkazem, ale rovnou v portálu. */
export function jeOtevriVPortalu(akce: { href: string }): boolean {
  return akce.href.startsWith('#');
}

/** Událost, kterou si panel řekne o okno s přehledem dne. */
export const UDALOST_PREHLED_DNE = 'ms:prehled-dne';

/** Co si smí do panelu dát uživatel s touhle rolí. */
export function quickActionsFor(role: Role): QuickAction[] {
  return QUICK_ACTIONS.filter((a) => a.roles.includes(role));
}

export function findQuickAction(key: string): QuickAction | undefined {
  return QUICK_ACTIONS.find((a) => a.key === key);
}

/**
 * Výchozí obsah panelu podle role - to, co daná role dělá nejčastěji.
 * Uživatel, který si panel neupravoval, nemá v databázi žádný řádek a vidí
 * vždycky aktuální výchozí sadu.
 */
export function defaultQuickActionKeys(role: Role): QuickActionKey[] {
  switch (role) {
    case 'CLIENT':
      return ['objednavka'];
    case 'HEREC':
      return [];
    case 'ZVUKAR':
      return ['prehled-dne', 'vykaz', 'termin'];
    case 'PRODUKCE':
      return ['prehled-dne', 'projekt', 'termin'];
    default:
      return ['prehled-dne', 'projekt', 'nabidka', 'faktura', 'smlouva', 'vydaj', 'termin'];
  }
}
