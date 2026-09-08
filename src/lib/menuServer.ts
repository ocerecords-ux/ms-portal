import type { Role } from '@prisma/client';
import { prisma } from '@/lib/db';
import { DEFAULT_MENU_ITEMS, canSee, type MenuEntry } from '@/lib/menu';

// Serverova cast listy (zadani 6. 9. 2026, prepracovano 8. 9. 2026) -
// oddelena od lib/menu.ts, protoze konstanty a typy odtamtud pouziva i
// klientsky Topbar a Prisma se do prohlizece dostat nesmi.

/**
 * Vsechny polozky listy v poradi, jak je admin nastavil. Kdyz tabulka jeste
 * neexistuje nebo je prazdna, zalozi se z vychozi sady - lista se tedy nikdy
 * nezobrazi prazdna a admin ma hned co presouvat.
 */
export async function loadMenuEntries(): Promise<MenuEntry[]> {
  try {
    const items = await prisma.menuItem.findMany({
      orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
    });
    if (items.length > 0) {
      return items.map((i) => ({ id: i.id, label: i.label, href: i.href }));
    }
    await seedDefaults();
    const seeded = await prisma.menuItem.findMany({ orderBy: [{ sortOrder: 'asc' }] });
    return seeded.map((i) => ({ id: i.id, label: i.label, href: i.href }));
  } catch (err) {
    // Databaze bez tabulky MenuItem (jeste nedobehl `prisma db push`) nesmi
    // shodit cely portal - lista proste zustane ve vychozim stavu.
    console.error('Nacteni menu selhalo, pouzivam vychozi:', err);
    return DEFAULT_MENU_ITEMS.map((i, index) => ({ id: `default-${index}`, label: i.label, href: i.href }));
  }
}

/** Co z listy uvidi konkretni role - ridi se pravy ke strance, ne nastavenim. */
export function visibleFor(entries: MenuEntry[], role: Role) {
  return entries.filter((e) => canSee(e.href, role)).map((e) => ({ href: e.href, label: e.label }));
}

export async function seedDefaults(): Promise<void> {
  await prisma.menuItem.createMany({
    data: DEFAULT_MENU_ITEMS.map((i) => ({
      label: i.label,
      href: i.href,
      sortOrder: i.sortOrder,
      // Sloupec roles zustava ve schematu z drivejska; viditelnost se uz
      // neridi jim, ale pravy ke strance (lib/menu.ts > PAGE_ACCESS).
      roles: ['CLIENT', 'HEREC', 'ADMIN', 'ZVUKAR', 'PRODUKCE'],
    })),
  });
}
