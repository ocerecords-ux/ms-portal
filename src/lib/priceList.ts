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

/**
 * Nazvy typu projektu, u kterych se vyrabi Rodny list - tedy radiove spoty
 * (upresneni 9. 9. 2026: "plati to jen u radiovych spotu").
 *
 * Priznak je na polozce ceniku (PriceListItem.rodnyList) a prepina se
 * v administraci. Zamerne se nehada podle nazvu: polozky se prejmenovavaji
 * a pribyvaji a "spot" muze byt i televizni.
 */
export async function listRodnyListProjectTypes(): Promise<string[]> {
  try {
    const items = await prisma.priceListItem.findMany({
      where: { rodnyList: true },
      select: { name: true },
    });
    return items.map((i) => i.name);
  } catch (err) {
    console.error('Nacteni typu projektu pro Rodny list selhalo:', err);
    return [];
  }
}

/** Je tenhle typ projektu radiovy spot, ke kteremu se dela Rodny list? */
export async function isRodnyListProjectType(projectType: string | null | undefined): Promise<boolean> {
  const typ = projectType?.trim();
  if (!typ) return false;
  try {
    const item = await prisma.priceListItem.findUnique({
      where: { name: typ },
      select: { rodnyList: true },
    });
    return item?.rodnyList === true;
  } catch (err) {
    console.error('Overeni typu projektu pro Rodny list selhalo:', err);
    return false;
  }
}

/**
 * Ikona ke kazdemu typu projektu (zadani 10. 9. 2026).
 *
 * Vraci se cely ciselnik naráz, ne ikona po ikone: prehled projektu je jedna
 * stranka s desitkami radku a dotaz na kazdy z nich by byl desitky dotazu
 * navic. I vyrazene polozky, aby projekt se starym typem ikonu neztratil.
 */
export async function mapaIkonTypu(): Promise<Record<string, string>> {
  try {
    const items = await prisma.priceListItem.findMany({
      where: { ikona: { not: null } },
      select: { name: true, ikona: true },
    });
    return Object.fromEntries(items.map((i) => [i.name, i.ikona as string]));
  } catch (err) {
    console.error('Nacteni ikon typu projektu selhalo:', err);
    return {};
  }
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
