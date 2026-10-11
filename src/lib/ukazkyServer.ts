import { prisma } from '@/lib/db';
import { adresaVUlozisti } from '@/lib/storage';
import { SEKCE, type Sekce, type UkazkaData } from '@/lib/prezentaceNabidky';

/**
 * KNIHOVNA UKÁZEK (zadání 11. 10. 2026). Reference z minulých projektů
 * a dema herců - nahrají se jednou a v každé nabídkové prezentaci se jen
 * zaškrtnou.
 *
 * Čte a zapisuje jen tahle vrstva; stránky dostanou hotová data bez klíčů
 * z úložiště, protože ta do prohlížeče nepatří - soubor se vydává přes
 * /api/ukazky/<id>/soubor.
 */

const VYBER = {
  id: true,
  druh: true,
  nazev: true,
  popis: true,
  typSouboru: true,
  delka: true,
  stitky: true,
} as const;

export async function nactiKnihovnu(vcetneVyrazenych = false): Promise<UkazkaData[]> {
  const radky = await prisma.ukazkaNabidky
    .findMany({
      where: vcetneVyrazenych ? {} : { aktivni: true },
      orderBy: [{ druh: 'asc' }, { poradi: 'asc' }, { createdAt: 'desc' }],
      select: VYBER,
    })
    .catch(() => []);
  return radky.map(naData);
}

export async function nactiUkazku(id: string) {
  return prisma.ukazkaNabidky
    .findUnique({
      where: { id },
      select: { id: true, url: true, typSouboru: true, nazev: true, aktivni: true },
    })
    .catch(() => null);
}

export function naData(r: {
  id: string;
  druh: string;
  nazev: string;
  popis: string | null;
  typSouboru: string;
  delka: number;
  stitky: string;
}): UkazkaData {
  return {
    id: r.id,
    druh: r.druh === SEKCE.herec ? SEKCE.herec : SEKCE.reference,
    nazev: r.nazev,
    popis: r.popis,
    typSouboru: r.typSouboru,
    delka: r.delka,
    stitky: r.stitky,
  };
}

export async function zalozUkazku(data: {
  druh: Sekce;
  nazev: string;
  popis?: string | null;
  herecId?: string | null;
  klic: string;
  nazevSouboru: string;
  typSouboru: string;
  velikost: number;
  delka: number;
  stitky?: string;
  nahralId: string;
}): Promise<UkazkaData | null> {
  const url = adresaVUlozisti(data.klic);
  if (!url) return null;

  /**
   * Nová ukázka jde na začátek svého druhu. Poslední nahraná je skoro vždycky
   * ta, kterou člověk zrovna chce použít - ať ji nemusí hledat dole.
   */
  const prvni = await prisma.ukazkaNabidky
    .findFirst({ where: { druh: data.druh }, orderBy: { poradi: 'asc' }, select: { poradi: true } })
    .catch(() => null);

  const radek = await prisma.ukazkaNabidky
    .create({
      data: {
        druh: data.druh,
        nazev: data.nazev,
        popis: data.popis?.trim() || null,
        herecId: data.herecId || null,
        url,
        nazevSouboru: data.nazevSouboru,
        typSouboru: data.typSouboru,
        velikost: data.velikost,
        delka: Math.max(0, Math.round(data.delka)),
        stitky: (data.stitky ?? '').trim(),
        poradi: (prvni?.poradi ?? 0) - 1,
        nahralId: data.nahralId,
      },
      select: VYBER,
    })
    .catch((err) => {
      console.error('Ukázku se nepodařilo uložit:', err);
      return null;
    });

  return radek ? naData(radek) : null;
}

export async function upravUkazku(
  id: string,
  zmeny: { nazev?: string; popis?: string | null; stitky?: string; aktivni?: boolean; poradi?: number },
): Promise<UkazkaData | null> {
  const radek = await prisma.ukazkaNabidky
    .update({
      where: { id },
      data: {
        ...(zmeny.nazev !== undefined ? { nazev: zmeny.nazev } : {}),
        ...(zmeny.popis !== undefined ? { popis: zmeny.popis?.trim() || null } : {}),
        ...(zmeny.stitky !== undefined ? { stitky: zmeny.stitky.trim() } : {}),
        ...(zmeny.aktivni !== undefined ? { aktivni: zmeny.aktivni } : {}),
        ...(zmeny.poradi !== undefined ? { poradi: zmeny.poradi } : {}),
      },
      select: VYBER,
    })
    .catch((err) => {
      console.error(`Ukázku ${id} se nepodařilo upravit:`, err);
      return null;
    });
  return radek ? naData(radek) : null;
}

/**
 * MAZÁNÍ JE JEN VYŘAZENÍ. Ukázka, která už je v odeslané prezentaci, by se
 * jinak klientovi uprostřed čtení ztratila - a prezentace se posílají
 * s tím, že si je klient otevře i za týden.
 */
export async function vyradUkazku(id: string): Promise<boolean> {
  const ok = await prisma.ukazkaNabidky
    .update({ where: { id }, data: { aktivni: false } })
    .catch(() => null);
  return Boolean(ok);
}
