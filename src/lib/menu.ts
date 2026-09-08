import type { Role } from '@prisma/client';

/**
 * Editovatelne menu v horni fialove liste (zadani 6. 9. 2026: "měla by být
 * možnost si modifikovat odkazy nahoře v menu v horní fialové liště").
 *
 * Tenhle soubor je zamerne bez pristupu do databaze - pouzivaji ho i klientske
 * komponenty (Topbar, MenuEditor). Nacitani z databaze je v lib/menuServer.ts.
 *
 * Zdrojem pravdy je tabulka MenuItem. Dokud je prazdna (cerstva databaze,
 * nebo admin jeste menu neotevrel), pouzije se DEFAULT_MENU_ITEMS - presne
 * ty polozky, ktere driv byly napevno v Topbaru. Lista tak nikdy neskonci
 * prazdna.
 */

export type NavItem = { href: string; label: string };

export const ALL_ROLES = ['CLIENT', 'HEREC', 'ADMIN', 'ZVUKAR', 'PRODUKCE'] as const;

export type MenuItemInput = {
  label: string;
  href: string;
  roles: Role[];
  visible: boolean;
};

export type MenuItemRow = MenuItemInput & { id: string; sortOrder: number };

/** Vychozi obsah listy - odpovida stavu pred zavedenim editoru menu. */
export const DEFAULT_MENU_ITEMS: (MenuItemInput & { sortOrder: number })[] = [
  { label: 'Projekty', href: '/projekty', roles: ['CLIENT', 'HEREC', 'ADMIN', 'ZVUKAR', 'PRODUKCE'], visible: true, sortOrder: 10 },
  { label: 'Objednávka', href: '/objednavka', roles: ['CLIENT'], visible: true, sortOrder: 20 },
  { label: 'Nahrávky', href: '/nahravky', roles: ['CLIENT'], visible: true, sortOrder: 30 },
  // Vykazy vidi Zvukar (svoje) a Zuzo-labuzo (vsechny) - zadani 6. 9. 2026.
  { label: 'Výkazy', href: '/vykazy', roles: ['ADMIN', 'ZVUKAR'], visible: true, sortOrder: 40 },
  { label: 'Firmy', href: '/admin', roles: ['ADMIN'], visible: true, sortOrder: 50 },
  { label: 'Uživatelé', href: '/admin/users', roles: ['ADMIN'], visible: true, sortOrder: 60 },
  { label: 'Ceníky', href: '/admin/ceniky', roles: ['ADMIN'], visible: true, sortOrder: 70 },
  { label: 'Menu', href: '/admin/menu', roles: ['ADMIN'], visible: true, sortOrder: 80 },
];

/**
 * Stranky portalu, ze kterych jde v editoru menu vybrat cil odkazu - aby
 * admin nemusel psat adresy rucne. Vlastni URL zustava jako moznost navic.
 */
export const PORTAL_PAGES: { href: string; label: string }[] = [
  { href: '/projekty', label: 'Projekty' },
  { href: '/objednavka', label: 'Objednávka' },
  { href: '/nahravky', label: 'Nahrávky' },
  { href: '/vykazy', label: 'Výkazy' },
  { href: '/muj-ucet', label: 'Můj účet' },
  { href: '/admin', label: 'Firmy (administrace)' },
  { href: '/admin/users', label: 'Uživatelé' },
  { href: '/admin/ceniky', label: 'Ceníky' },
  { href: '/admin/menu', label: 'Menu' },
];

/** Vychozi (napevno zadana) navigace pro danou roli. */
export function defaultNavFor(role: Role): NavItem[] {
  return DEFAULT_MENU_ITEMS.filter((i) => i.visible && i.roles.includes(role))
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((i) => ({ href: i.href, label: i.label }));
}

/** Odkaz mimo portal (vlastni URL) se otevira jako obycejny <a>. */
export function isExternalHref(href: string): boolean {
  return /^https?:\/\//i.test(href);
}
