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
  | 'firma';

export type QuickAction = {
  key: QuickActionKey;
  label: string;
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
];

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
      return ['vykaz', 'termin'];
    case 'PRODUKCE':
      return ['projekt', 'termin'];
    default:
      return ['projekt', 'nabidka', 'faktura', 'smlouva', 'vydaj', 'termin'];
  }
}
