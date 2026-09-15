import { prisma } from '@/lib/db';
import { KLICE_OZNAMENI, type KlicOznameni } from '@/lib/oznameni';

/**
 * Zapnutí a vypnutí automatických zpráv (zadání 15. 9. 2026). Viz
 * lib/oznameni.ts, kde je jejich seznam - tady je jen práce s databází.
 *
 * CO NENÍ ULOŽENÉ, JE ZAPNUTÉ. Chybějící řádek (nebo nedostupná tabulka)
 * proto nesmí zprávu umlčet - to by se poznalo až tím, že někomu nic
 * nepřišlo.
 */

export async function nactiZapnuti(): Promise<Record<string, boolean>> {
  const vychozi = Object.fromEntries(KLICE_OZNAMENI.map((k) => [k, true]));
  try {
    const radky = await prisma.nastaveniOznameni.findMany();
    for (const r of radky) vychozi[r.klic] = r.zapnuto;
  } catch (err) {
    console.error('Nastavení oznámení se nepodařilo načíst:', err);
  }
  return vychozi;
}

/** Smí tahle zpráva odejít? */
export async function jeZapnuto(klic: KlicOznameni): Promise<boolean> {
  try {
    const radek = await prisma.nastaveniOznameni.findUnique({ where: { klic } });
    return radek ? radek.zapnuto : true;
  } catch (err) {
    console.error(`Nastavení oznámení „${klic}" se nepodařilo načíst:`, err);
    return true;
  }
}

export async function nastavZapnuti(
  klic: KlicOznameni,
  zapnuto: boolean,
  zmenilJmeno: string | null,
): Promise<void> {
  await prisma.nastaveniOznameni.upsert({
    where: { klic },
    create: { klic, zapnuto, zmenilJmeno },
    update: { zapnuto, zmenilJmeno },
  });
}
