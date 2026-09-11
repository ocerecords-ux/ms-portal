import type { Role } from '@prisma/client';

/**
 * Odkazy v horní fialové liště (zadani 6. 9. 2026, prepracovano 8. 9. 2026).
 *
 * Uprava se dela primo v liste - tri tecky vpravo, volba "Upravit" (mazani a
 * pridani zkratky) nebo "Presunout" (pretahovani poradi), jako na ploche
 * iPhonu. Zadna samostatna administracni stranka uz neni.
 *
 * KDO CO UVIDI SE NENASTAVUJE. Ridi se to pravy k dane strance - viz
 * PAGE_ACCESS nize, ktere odpovida tomu, kam kterou roli pousti middleware a
 * serverove komponenty. Admin tedy urcuje jen POradi a to, co v liste je.
 *
 * Tenhle soubor je zamerne bez pristupu do databaze - pouzivaji ho i klientske
 * komponenty (Topbar). Nacitani z databaze je v lib/menuServer.ts.
 */

export type NavItem = { href: string; label: string };
export type MenuEntry = { id: string; label: string; href: string };

export const ALL_ROLES: Role[] = ['CLIENT', 'HEREC', 'ADMIN', 'ZVUKAR', 'PRODUKCE'];

/**
 * Kdo se dostane na kterou stranku. Musi odpovidat middleware.ts a kontrolam
 * primo ve strankach - lista jen nezobrazuje odkaz tam, kam by uzivatele
 * stejne nepustila.
 */
export const PAGE_ACCESS: Record<string, Role[]> = {
  '/projekty': ALL_ROLES,
  '/muj-ucet': ALL_ROLES,
  // Objednavka a Nahravky jsou klientska agenda.
  '/objednavka': ['CLIENT'],
  '/nahravky': ['CLIENT'],
  // Vykazy: zvukar svoje, Zuzo-labuzo prehled celeho tymu.
  '/vykazy': ['ADMIN', 'ZVUKAR'],
  // Kalendare studii (zadani 8. 9. 2026): Produkce a Zuzo-labuzo zapisuji,
  // zvukar jen cte. Herec ma vlastni, uzsi pohled.
  '/kalendar': ['ADMIN', 'PRODUKCE', 'ZVUKAR'],
  '/moje-terminy': ['HEREC'],
  // Administrace - jen Zuzo-labuzo.
  '/admin': ['ADMIN'],
  // Firmy z Caflou uz nejsou v menu (odpojeni 11. 9. 2026), stranka ale
  // zustava - je to posledni cesta, jak neco z Caflou dohledat.
  '/admin/caflou-firmy': ['ADMIN'],
  '/admin/users': ['ADMIN'],
  '/admin/ceniky': ['ADMIN'],
  '/admin/studia': ['ADMIN'],
  '/admin/doklady': ['ADMIN'],
  '/admin/archiv': ['ADMIN'],
};

/** Uvidi uzivatel s touhle roli tenhle odkaz? Vlastni odkaz vidi kazdy. */
export function canSee(href: string, role: Role): boolean {
  const allowed = PAGE_ACCESS[href];
  return allowed ? allowed.includes(role) : true;
}

/** Vychozi obsah listy - odpovida stavu pred zavedenim editace. */
export const DEFAULT_MENU_ITEMS: { label: string; href: string; sortOrder: number }[] = [
  { label: 'Projekty', href: '/projekty', sortOrder: 10 },
  { label: 'Objednávka', href: '/objednavka', sortOrder: 20 },
  { label: 'Nahrávky', href: '/nahravky', sortOrder: 30 },
  { label: 'Výkazy', href: '/vykazy', sortOrder: 40 },
  { label: 'Kalendář', href: '/kalendar', sortOrder: 45 },
  { label: 'Moje termíny', href: '/moje-terminy', sortOrder: 46 },
  { label: 'Firmy', href: '/admin', sortOrder: 50 },
  { label: 'Uživatelé', href: '/admin/users', sortOrder: 60 },
  { label: 'Ceníky', href: '/admin/ceniky', sortOrder: 70 },
  { label: 'Doklady', href: '/admin/doklady', sortOrder: 80 },
];

/** Stranky, ktere jde pridat zpet do listy pres "+" v rezimu Upravit. */
export const PORTAL_PAGES: { href: string; label: string }[] = [
  { href: '/projekty', label: 'Projekty' },
  { href: '/objednavka', label: 'Objednávka' },
  { href: '/nahravky', label: 'Nahrávky' },
  { href: '/vykazy', label: 'Výkazy' },
  { href: '/kalendar', label: 'Kalendář' },
  { href: '/moje-terminy', label: 'Moje termíny' },
  { href: '/admin', label: 'Firmy' },
  { href: '/admin/users', label: 'Uživatelé' },
  { href: '/admin/ceniky', label: 'Ceníky' },
  { href: '/admin/studia', label: 'Studia' },
  { href: '/admin/doklady', label: 'Doklady' },
  // Archiv smazanych zaznamu (zadani 10. 9. 2026). Neni ve vychozi liste -
  // clovek tam chodi jednou za rok, kdyz neco smazal a chce to zpatky.
  { href: '/admin/archiv', label: 'Archiv' },
  { href: '/muj-ucet', label: 'Můj účet' },
];

/** Vychozi (napevno zadana) navigace pro danou roli. */
export function defaultNavFor(role: Role): NavItem[] {
  return DEFAULT_MENU_ITEMS.filter((i) => canSee(i.href, role))
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((i) => ({ href: i.href, label: i.label }));
}

/** Odkaz mimo portal (vlastni URL) se otevira jako obycejny <a>. */
export function isExternalHref(href: string): boolean {
  return /^https?:\/\//i.test(href);
}
