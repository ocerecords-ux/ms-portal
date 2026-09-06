import { prisma } from '@/lib/db';

/**
 * Cenik (zadani 5. 9. 2026) - jedna databaze, dve pouziti:
 *  1) cenik sluzeb (polozka + cena bez DPH + cena s DPH),
 *  2) ciselnik TYPU PROJEKTU: u projektu jde vybrat jen to, co je v ceniku.
 *
 * V ProjectMeta.projectType se uklada primo nazev polozky (je unikatni), aby
 * zustal citelny i kdyby polozku nekdo z ceniku pozdeji vyradil.
 */

/** Vychozi polozky pri prvnim spusteni - dal se doplnuje uz jen v administraci. */
export const DEFAULT_PRICE_LIST_ITEMS = [
  'Natáčení a postprodukce audioknihy',
  'Výroba rádiového spotu',
  'Natáčení voiceoveru',
];

/** Sazba DPH pro dopocet ceny s DPH, kdyz ji admin nevyplni. */
export const VAT_RATE = 0.21;

export function withVat(priceExVat: number): number {
  return Math.round(priceExVat * (1 + VAT_RATE));
}

/** Nazvy polozek pouzitelne jako typ projektu (jen aktivni, v poradi ceniku). */
export async function listProjectTypeOptions(): Promise<string[]> {
  const items = await prisma.priceListItem.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: { name: true },
  });
  return items.map((i) => i.name);
}
