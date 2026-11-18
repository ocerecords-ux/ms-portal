import { prisma } from '@/lib/db';
import { KLICE_OZNAMENI, OZNAMENI, zneniOznameni, type KlicOznameni } from '@/lib/oznameni';

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

/**
 * VLASTNÍ ZNĚNÍ ZPRÁV (zadání 18. 11. 2026). Prázdné pole znamená „plať
 * výchozí" - tím se text vrací zpátky, aniž by bylo potřeba druhé tlačítko.
 */
export type UlozeneZneni = { predmet: string | null; nadpis: string | null; text: string | null };

export async function nactiZneni(): Promise<Record<string, UlozeneZneni>> {
  try {
    const radky = await prisma.nastaveniOznameni.findMany({
      select: { klic: true, predmet: true, nadpis: true, text: true },
    });
    return Object.fromEntries(
      radky.map((r) => [r.klic, { predmet: r.predmet, nadpis: r.nadpis, text: r.text }]),
    );
  } catch (err) {
    console.error('Znění oznámení se nepodařilo načíst:', err);
    return {};
  }
}

/** Znění jedné zprávy - uložené, nebo výchozí z lib/oznameni.ts. */
export async function zneni(klic: KlicOznameni) {
  const popis = OZNAMENI.find((o) => o.klic === klic);
  if (!popis) return { predmet: '', nadpis: '', text: '' };
  try {
    const radek = await prisma.nastaveniOznameni.findUnique({
      where: { klic },
      select: { predmet: true, nadpis: true, text: true },
    });
    return zneniOznameni(popis, radek as UlozeneZneni | null);
  } catch (err) {
    console.error(`Znění oznámení „${klic}" se nepodařilo načíst:`, err);
    return zneniOznameni(popis, null);
  }
}

export async function nastavZneni(
  klic: KlicOznameni,
  zneni: { predmet?: string; nadpis?: string; text?: string },
  zmenilJmeno: string | null,
): Promise<void> {
  // Prázdno se ukládá jako null, ne jako prázdný řetězec - podle něj se pozná,
  // že má platit výchozí text.
  const data = {
    ...(zneni.predmet !== undefined ? { predmet: zneni.predmet.trim() || null } : {}),
    ...(zneni.nadpis !== undefined ? { nadpis: zneni.nadpis.trim() || null } : {}),
    ...(zneni.text !== undefined ? { text: zneni.text.trim() || null } : {}),
  };
  await prisma.nastaveniOznameni.upsert({
    where: { klic },
    create: { klic, zapnuto: true, zmenilJmeno, ...data },
    update: { zmenilJmeno, ...data },
  });
}
