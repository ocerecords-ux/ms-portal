import type { Role } from '@prisma/client';
import { prisma } from '@/lib/db';
import { DEFAULT_MENU_ITEMS, PORTAL_PAGES, canSee, type MenuEntry, type NavItem } from '@/lib/menu';

// Serverova cast listy (zadani 6. 9. 2026, prepracovano 8. 9. 2026) -
// oddelena od lib/menu.ts, protoze konstanty a typy odtamtud pouziva i
// klientsky Topbar a Prisma se do prohlizece dostat nesmi.
//
// Lista je nove NA KAZDEHO UZIVATELE ZVLAST (zadani 8. 9. 2026: "kdyz jsem si
// dal z vrchni listy pryc vykazy, zmizelo to vsude i u zvukaru"). Drive byla
// jedna spolecna tabulka MenuItem pro cely portal - ta uz neexistuje.

/**
 * Lista prihlaseneho uzivatele. Kdyz si ji jeste neupravoval, dostane
 * vychozi sadu z lib/menu.ts - nikam se nic nezaklada, takze cerstvy ucet
 * nema v databazi zadny radek a porad vidi aktualni vychozi listu.
 */
export async function loadMenuEntries(userId: string): Promise<MenuEntry[]> {
  try {
    const items = await prisma.userMenuItem.findMany({
      where: { userId },
      orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
    });
    if (items.length > 0) {
      return items.map((i) => ({ id: i.id, label: i.label, href: i.href }));
    }
  } catch (err) {
    // Databaze bez tabulky UserMenuItem (jeste nedobehl `prisma db push`) nesmi
    // shodit cely portal - lista proste zustane ve vychozim stavu.
    console.error('Nacteni menu selhalo, pouzivam vychozi:', err);
  }
  return defaultEntries();
}

function defaultEntries(): MenuEntry[] {
  return DEFAULT_MENU_ITEMS.slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((i, index) => ({ id: `default-${index}`, label: i.label, href: i.href }));
}

/** Co z listy uvidi konkretni role - ridi se pravy ke strance, ne nastavenim. */
export function visibleFor(entries: MenuEntry[], role: Role): NavItem[] {
  return entries.filter((e) => canSee(e.href, role)).map((e) => ({ href: e.href, label: e.label }));
}

/**
 * Stranky, ktere si uzivatel muze dat do listy pres "+": vsechny, na ktere
 * ma pravo. Co uz v liste je, si odfiltruje Topbar sam - jinak by se
 * odebrana polozka nedala hned vratit zpatky.
 */
export function pageOptionsFor(role: Role): NavItem[] {
  return PORTAL_PAGES.filter((p) => canSee(p.href, role));
}
