import { prisma } from '@/lib/db';
import { klicSerie } from '@/lib/serie';

/**
 * SÉRIE JEDNÉ FIRMY (zadání 14. 10. 2026). Detail projektu z toho bere dvojí:
 *
 *  1. DÍLY TÉHOŽ TITULU do okénka u kolečka - ať se dá skočit na předchozí díl.
 *  2. NAŠEPTÁVAČ do pole „Název série". Bez něj bychom za rok měli
 *     „Tajemství rodu Musovských", „Tajemstvi rodu musovskych" a „Rod
 *     Musovských" jako tři různé série a nic by se neslepilo dohromady.
 *
 * Hledá se jen u TÉ FIRMY: série patří vydavateli, ne portálu, a cizí názvy
 * by v našeptávači jen překážely.
 *
 * Nikdy nevyhazuje - detail projektu se kvůli našeptávači nesmí rozbít.
 */
export async function nactiSerieFirmy(
  companyId: string | null | undefined,
  serie?: string | null,
): Promise<{ navrhy: string[]; dily: { id: number; name: string; dil: number | null }[] }> {
  if (!companyId) return { navrhy: [], dily: [] };
  try {
    const radky = await prisma.projectMeta.findMany({
      where: { companyId, serie: { not: null }, name: { not: null } },
      select: { caflouProjectId: true, name: true, serie: true, serieDil: true },
      take: 500,
    });

    // Návrhy: každá série jednou, v té podobě, jak je napsaná nejčastěji.
    const podleKlice = new Map<string, string>();
    for (const r of radky) {
      const klic = klicSerie(r.serie);
      if (klic && !podleKlice.has(klic)) podleKlice.set(klic, (r.serie ?? '').trim());
    }

    const hledany = klicSerie(serie);
    const dily = hledany
      ? radky
          .filter((r) => klicSerie(r.serie) === hledany)
          .map((r) => ({ id: Number(r.caflouProjectId), name: r.name ?? '', dil: r.serieDil ?? null }))
          .sort((a, b) => {
            if (a.dil != null && b.dil != null) return a.dil - b.dil;
            if (a.dil != null) return -1;
            if (b.dil != null) return 1;
            return a.name.localeCompare(b.name, 'cs');
          })
      : [];

    return {
      navrhy: [...podleKlice.values()].sort((a, b) => a.localeCompare(b, 'cs')),
      dily,
    };
  } catch (err) {
    console.error('Série firmy se nepodařilo načíst:', err);
    return { navrhy: [], dily: [] };
  }
}
