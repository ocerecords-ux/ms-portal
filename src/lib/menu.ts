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
  // Backlog - odevzdali jsme v terminu? (zadani 18. 9. 2026). Od 21. 9. 2026
  // je to zalozka Prehledu, /backlog jen presmerovava. Terminy planuje
  // a meni Zuzo-labuzo s Produkci, tem to taky patri.
  '/backlog': ['ADMIN', 'PRODUKCE'],
  '/muj-ucet': ALL_ROLES,
  // Navody k portalu (zadani 16. 9. 2026). Do listy si je muze dat jen tym -
  // herci a klienti nase interni navody nevidi (19. 9. 2026); navod psany
  // primo pro ne najdou pod otaznikem v liste.
  '/napoveda': ['ADMIN', 'PRODUKCE', 'ZVUKAR'],
  // Objednavka a Nahravky jsou klientska agenda.
  '/objednavka': ['CLIENT'],
  '/nahravky': ['CLIENT'],
  // Vykazy: zvukar svoje, Zuzo-labuzo prehled celeho tymu.
  '/vykazy': ['ADMIN', 'ZVUKAR'],
  // Kalendare studii (zadani 8. 9. 2026): Produkce a Zuzo-labuzo zapisuji,
  // zvukar jen cte. Herec ma vlastni, uzsi pohled.
  '/kalendar': ['ADMIN', 'PRODUKCE', 'ZVUKAR'],
  '/moje-terminy': ['HEREC'],
  // Přehledy (zadání 20. 9. 2026: „samostatnou kategorii na hlavním panelu
  // s názvem Přehledy") - zatím Kapacita studií. Je to pohled na vytížení
  // firmy, takže Žůžo-labůžo a produkce.
  '/prehledy': ['ADMIN', 'PRODUKCE'],
  // Honorare herce - navrhnuto / ceka na proplaceni / zaplaceno (19. 9. 2026).
  '/honorare': ['HEREC'],
  // Pozvanky hercu (zadani 16. 9. 2026: „tohle tlacitko musi mit zaple
  // Zuzo-labuzo i Helca - produkce"). Administrace je jen pro ADMIN,
  // proto samostatna stranka i pro Produkci.
  '/pozvanky': ['ADMIN', 'PRODUKCE'],
  // Administrace - jen Zuzo-labuzo.
  '/admin': ['ADMIN'],
  // Firmy z Caflou uz nejsou v menu (odpojeni 11. 9. 2026), stranka ale
  // zustava - je to posledni cesta, jak neco z Caflou dohledat.
  '/admin/caflou-firmy': ['ADMIN'],
  '/admin/vzory-zprav': ['ADMIN'],
  '/admin/zpravy-portalu': ['ADMIN'],
  '/admin/users': ['ADMIN'],
  '/admin/ceniky': ['ADMIN'],
  '/admin/studia': ['ADMIN'],
  '/admin/doklady': ['ADMIN'],
  '/admin/archiv': ['ADMIN'],
  // Co Bruno vi o nasi praci (zadani 16. 9. 2026).
  '/admin/bruno': ['ADMIN'],
  '/admin/navody': ['ADMIN'],
  // Zadosti o udaje hercu a firem odkazem (zadani 16. 9. 2026).
  '/admin/udaje': ['ADMIN'],
  // Tabule ve studiu v liště (zadání 23. 9. 2026: „dej jim ty tabule na horní
  // lištu přímo"). Odkaz se do lišty přidá jen tomu, kdo má na kartě
  // zaškrtnutý přístup - viz layout portálu; tohle je jen kontrola role.
  '/tabule/moje': ['ADMIN', 'PRODUKCE', 'ZVUKAR'],
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
  { label: 'Přehledy', href: '/prehledy', sortOrder: 48 },
  { label: 'Moje termíny', href: '/moje-terminy', sortOrder: 46 },
  { label: 'Honoráře', href: '/honorare', sortOrder: 47 },
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
  { href: '/prehledy', label: 'Přehledy' },
  { href: '/moje-terminy', label: 'Moje termíny' },
  { href: '/honorare', label: 'Honoráře' },
  { href: '/admin', label: 'Firmy' },
  { href: '/admin/users', label: 'Uživatelé' },
  { href: '/admin/ceniky', label: 'Ceníky' },
  { href: '/admin/studia', label: 'Studia' },
  { href: '/admin/zpravy-portalu', label: 'Zprávy portálu' },
  { href: '/admin/doklady', label: 'Doklady' },
  // Archiv smazanych zaznamu (zadani 10. 9. 2026). Neni ve vychozi liste -
  // clovek tam chodi jednou za rok, kdyz neco smazal a chce to zpatky.
  { href: '/admin/archiv', label: 'Archiv' },
  // Prirucka pro Bruna (zadani 16. 9. 2026). Neni ve vychozi liste - clovek
  // tam jde, kdyz se Bruno chova jinak, nez by mel.
  { href: '/admin/bruno', label: 'Bruno' },
  // Zadosti o udaje odkazem (zadani 16. 9. 2026).
  { href: '/admin/udaje', label: 'Údaje' },
  // Pozvanky hercu (zadani 16. 9. 2026) - pro Zuzo-labuzo i Produkci.
  { href: '/pozvanky', label: 'Pozvánky' },
  // Navody k portalu (zadani 16. 9. 2026).
  { href: '/napoveda', label: 'Nápověda' },
  { href: '/admin/navody', label: 'Návody' },
  { href: '/muj-ucet', label: 'Můj účet' },
];

/** Vychozi (napevno zadana) navigace pro danou roli. */
export function defaultNavFor(role: Role): NavItem[] {
  return DEFAULT_MENU_ITEMS.filter((i) => canSee(i.href, role))
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((i) => ({ href: i.href, label: i.label }));
}

/** Odkaz mimo portal (vlastni URL) se otevira jako obycejny <a>. */
/** Odkaz na tabuli v liště - přidává se jen komu ji admin povolil. */
export const TABULE_ITEM: NavItem = { href: '/tabule/moje', label: 'Tabule' };

export function isExternalHref(href: string): boolean {
  return /^https?:\/\//i.test(href);
}
