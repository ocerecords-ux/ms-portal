import { prisma } from '@/lib/db';

/**
 * CENÍK DO DOKLADŮ (zadání 19. 11. 2026, upřesněno 20. 11.: „prostě dejme
 * někde u toho řádku, kde píšu položku, + a já tam přidám položku, kterou mám
 * v ceníku - Výroba rádiového spotu").
 *
 * JE JEN JEDEN CENÍK - ten v menu Ceníky (model PriceListItem). Napoprvé jsem
 * sáhl na ceník STUDIA, což je úplně jiná tabulka pro pobočky a slouží
 * k vystavení cenové nabídky v PDF; v korunách v ní nic není. Tenhle modul
 * proto čte jen náš ceník a nic jiného nenabízí.
 *
 * Ceny jsou v CELÝCH KORUNÁCH BEZ DPH, doklady počítají v haléřích - převod
 * je tady, na jednom místě. Položka bez ceny se nabízí taky; cenu doplní
 * člověk v dokladu.
 */

export type PolozkaCeniku = {
  klic: string;
  popis: string;
  /** Cena bez DPH v haléřích; null = ceník ji neuvádí. */
  cenaMinor: number | null;
};

export async function cenikProDoklady(): Promise<PolozkaCeniku[]> {
  try {
    const polozky = await prisma.priceListItem.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, priceExVat: true },
    });
    return polozky
      .filter((i) => i.name.trim())
      .map((i) => ({
        klic: i.id,
        popis: i.name.trim(),
        cenaMinor: i.priceExVat === null ? null : Math.round(i.priceExVat * 100),
      }));
  } catch (err) {
    console.error('Cenik pro doklady se nepodarilo nacist:', err);
    return [];
  }
}
