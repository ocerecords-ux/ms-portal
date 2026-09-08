import type { Role } from '@prisma/client';
import { prisma } from '@/lib/db';
import { DEFAULT_MENU_ITEMS, defaultNavFor, type NavItem } from '@/lib/menu';

// Serverova cast editovatelneho menu (zadani 6. 9. 2026) - oddelena od
// lib/menu.ts, protoze konstanty a typy odtamtud pouzivaji i klientske
// komponenty a Prisma se do prohlizece dostat nesmi.

/**
 * Polozky listy pro prihlaseneho uzivatele. Kdyz tabulka jeste neexistuje
 * nebo je prazdna, vrati vychozi menu - lista se nikdy nezobrazi prazdna.
 * Prazdny vysledek pro konkretni roli je naopak legitimni volba admina
 * (rekl, ze tahle role nema videt nic), a proto se nedoplnuje.
 */
export async function loadMenuForRole(role: Role): Promise<NavItem[]> {
  try {
    const items = await prisma.menuItem.findMany({
      where: { visible: true },
      orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
    });
    if (items.length === 0) return defaultNavFor(role);
    return items
      .filter((i) => i.roles.includes(role))
      .map((i) => ({ href: i.href, label: i.label }));
  } catch (err) {
    // Databaze bez tabulky MenuItem (jeste nedobehl `prisma db push`) nesmi
    // shodit cely portal - lista proste zustane ve vychozim stavu.
    console.error('Nacteni menu selhalo, pouzivam vychozi:', err);
    return defaultNavFor(role);
  }
}

/** Prvni otevreni editoru menu zalozi vychozi polozky, aby bylo co upravovat. */
export async function ensureMenuSeeded(): Promise<void> {
  const count = await prisma.menuItem.count();
  if (count > 0) return;
  await prisma.menuItem.createMany({ data: DEFAULT_MENU_ITEMS });
}
