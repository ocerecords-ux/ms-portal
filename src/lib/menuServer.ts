import type { Role } from '@prisma/client';
import { prisma } from '@/lib/db';
import { DEFAULT_MENU_ITEMS, canSee, type MenuEntry } from '@/lib/menu';

// Serverova cast listy (zadani 6. 9. 2026, prepracovano 8. 9. 2026) -
// oddelena od lib/menu.ts, protoze konstanty a typy odtamtud pouziva i
// klientsky Topbar a Prisma se do prohlizece dostat nesmi.

/**
 * Odkazy na stranky, ktere uz v portalu nejsou. Prvni nasazeni editovatelneho
 * menu jeste zakladalo polozku "Menu" mirici na /admin/menu; tu stranku
 * nahradila uprava primo v liste, takze by odkaz vedl na nic. Pri nacteni je
 * proto z databaze rovnou vyhodime - uzivatel to nema co resit rucne.
 */
const REMOVED_HREFS = ['/admin/menu'];

/**
 * Vsechny polozky listy v poradi, jak je admin nastavil. Kdyz tabulka jeste
 * neexistuje nebo je prazdna, zalozi se z vychozi sady - lista se tedy nikdy
 * nezobrazi prazdna a admin ma hned co presouvat.
 */
export async function loadMenuEntries(): Promise<MenuEntry[]> {
  try {
    let items = await prisma.menuItem.findMany({
      orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
    });

    // Jednorazovy uklid: vyhodit odkazy na zrusene stranky a doplnit sekce,
    // ktere vznikly az po zalozeni listy (lista se seedovala driv, nez byly
    // Doklady, takze by na ne nesel odkaz). Bezi jen jednou - jakmile stara
    // polozka zmizi, uz se sem nikdy nevejdeme, takze rucne odebranou polozku
    // to uzivateli nikdy nevrati zpatky.
    if (items.some((i) => REMOVED_HREFS.includes(i.href))) {
      await prisma.menuItem.deleteMany({ where: { href: { in: REMOVED_HREFS } } });
      items = items.filter((i) => !REMOVED_HREFS.includes(i.href));

      const missing = DEFAULT_MENU_ITEMS.filter(
        (d) => d.href === '/admin/doklady' && !items.some((i) => i.href === d.href),
      );
      if (missing.length > 0) {
        await prisma.menuItem.createMany({
          data: missing.map((d) => ({
            label: d.label,
            href: d.href,
            sortOrder: d.sortOrder,
            roles: ['CLIENT', 'HEREC', 'ADMIN', 'ZVUKAR', 'PRODUKCE'],
          })),
        });
        items = await prisma.menuItem.findMany({ orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }] });
      }
    }

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
