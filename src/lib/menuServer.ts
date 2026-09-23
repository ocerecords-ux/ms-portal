import type { Role } from '@prisma/client';
import { prisma } from '@/lib/db';
import { DEFAULT_MENU_ITEMS, PORTAL_PAGES, TABULE_ITEM, canSee, type MenuEntry, type NavItem } from '@/lib/menu';
import type { Zarizeni } from '@/lib/zarizeni';

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
export async function loadMenuEntries(
  userId: string,
  zarizeni: Zarizeni = 'POCITAC',
  /** Má v liště být i Tabule? Platí jen pro výchozí lištu - viz sTabuli. */
  maTabuli = false,
): Promise<MenuEntry[]> {
  try {
    const items = await prisma.userMenuItem.findMany({
      where: { userId, zarizeni },
      orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
    });
    if (items.length > 0) {
      return items.map((i) => ({ id: i.id, label: i.label, href: i.href }));
    }
    // LISTA MOBILU, KTEROU SI NIKDO NEUPRAVIL (zadani 19. 9. 2026), je stejna
    // jako lista pocitace - kdo si ji na pocitaci poskladal, nechce ji v mobilu
    // skladat znovu od nuly. Rozejdou se az ve chvili, kdy si mobil upravi.
    if (zarizeni === 'MOBIL') return loadMenuEntries(userId, 'POCITAC', maTabuli);
  } catch (err) {
    // Databaze bez tabulky UserMenuItem (jeste nedobehl `prisma db push`) nesmi
    // shodit cely portal - lista proste zustane ve vychozim stavu.
    console.error('Nacteni menu selhalo, pouzivam vychozi:', err);
  }
  return defaultEntries(maTabuli);
}

function defaultEntries(maTabuli = false): MenuEntry[] {
  const zaklad = DEFAULT_MENU_ITEMS.slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((i, index) => ({ id: `default-${index}`, label: i.label, href: i.href }));
  // Tabule ve studiu (23. 9. 2026) - jen komu ji admin povolil.
  return maTabuli ? [...zaklad, { id: 'default-tabule', label: TABULE_ITEM.label, href: TABULE_ITEM.href }] : zaklad;
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
export function pageOptionsFor(role: Role, maTabuli = false): NavItem[] {
  const strany = PORTAL_PAGES.filter((p) => canSee(p.href, role));
  return maTabuli ? [...strany, TABULE_ITEM] : strany;
}

/**
 * Tabule v liště (zadání 23. 9. 2026). Kdo má na kartě zaškrtnutý přístup,
 * má odkaz v liště rovnou - a když si ho odsud smaže, zůstane smazaný
 * (lištu si každý skládá sám).
 */
export function sTabuli(items: NavItem[], maTabuli: boolean, vychoziListou: boolean): NavItem[] {
  if (!maTabuli || items.some((i) => i.href === TABULE_ITEM.href)) return items;
  // Kdo si lištu poskládal sám, dostal Tabuli jednorázově do svých položek
  // (seed) - a když si ji odtud smaže, nevrací se mu tam.
  return vychoziListou ? [...items, TABULE_ITEM] : items;
}
