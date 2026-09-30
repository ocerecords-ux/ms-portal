import { prisma } from '@/lib/db';
import { listRodnyListProjectTypes, nazevTypuAudioknihy } from '@/lib/priceList';
import { jeReklamniProjekt, type PodkladyReklamy } from '@/lib/reklamniProjekt';

/**
 * Serverová obálka nad `jeReklamniProjekt` (30. 9. 2026). Číselník typů je
 * v databázi, takže se načte jednou a pak se jen porovnává — právě proto je
 * samo rozhodování čistá funkce v lib/reklamniProjekt.ts: denní úlohy ho
 * pouštějí přes stovky projektů a dotaz na každý z nich by byl stovka dotazů
 * navíc.
 */
export type CiselnikReklam = Pick<PodkladyReklamy, 'typAudioknihy' | 'typyRodnehoListu'>;

export async function nactiCiselnikReklam(): Promise<CiselnikReklam> {
  const [typyRodnehoListu, typAudioknihy] = await Promise.all([
    listRodnyListProjectTypes(),
    nazevTypuAudioknihy(),
  ]);
  return { typyRodnehoListu, typAudioknihy };
}

/**
 * Co z řádku projektu potřebujeme. Pole jsou schválně nepovinná, aby se sem
 * dal podat i výsledek `select`u, který má navíc jiné sloupce - důležité je,
 * ať volající NEZAPOMENE vybrat `company`, jinak projekt vyjde jako audiokniha.
 */
type MetaProReklamu = {
  projectType?: string | null;
  company?: { dealsAds?: boolean | null; dealsAudiobooks?: boolean | null } | null;
};

/** Rozhodnutí nad už načteným řádkem projektu. */
export function jeReklamaPodleMeta(meta: MetaProReklamu, ciselnik: CiselnikReklam): boolean {
  return jeReklamniProjekt({
    projectType: meta.projectType,
    typAudioknihy: ciselnik.typAudioknihy,
    typyRodnehoListu: ciselnik.typyRodnehoListu,
    firmaDelaReklamy: meta.company?.dealsAds === true,
    firmaDelaAudioknihy: meta.company?.dealsAudiobooks === true,
  });
}

/** Rozhodnutí pro jeden projekt, když volající nemá nic načteného. */
export async function jeReklamaProjekt(caflouProjectId: string): Promise<boolean> {
  try {
    const [meta, ciselnik] = await Promise.all([
      prisma.projectMeta.findUnique({
        where: { caflouProjectId },
        select: {
          projectType: true,
          company: { select: { dealsAds: true, dealsAudiobooks: true } },
        },
      }),
      nactiCiselnikReklam(),
    ]);
    if (!meta) return false;
    return jeReklamaPodleMeta(meta, ciselnik);
  } catch (err) {
    console.error(`Nepodařilo se zjistit, jestli je projekt ${caflouProjectId} reklama:`, err);
    return false;
  }
}
