import { prisma } from '@/lib/db';
import { klicSerie } from '@/lib/serie';

/**
 * SÉRIE PRO DETAIL PROJEKTU A PRO OBJEDNÁVKU (zadání 14. 10. 2026). Bere se
 * z toho dvojí:
 *
 *  1. DÍLY TÉHOŽ TITULU do okénka u kolečka - ať se dá skočit na předchozí díl.
 *  2. NAŠEPTÁVAČ do pole „Název série". Bez něj bychom za rok měli
 *     „Tajemství rodu Musovských", „Tajemstvi rodu musovskych" a „Rod
 *     Musovských" jako tři různé série a nic by se neslepilo dohromady.
 *
 * NAŠEPTÁVAČ UMÍ CELÝ PORTÁL, NE JEN JEDNU FIRMU (oprava 18. 10. 2026: „tady
 * je uz zavedena serie, ale delal to nekdo jiny z tymu. Akorat mi to
 * nenabidne. to musi byt nekde v databazi na jednom miste ty serie, kdyz je
 * nekdo zavede").
 *
 * Původně se hledalo jen u firmy projektu - a to selhávalo přesně tam, kde
 * má našeptávač pomoct: u projektu, který firmu v portálu navázanou nemá
 * (pak se nenabízelo vůbec nic), a u série, kterou kolega zavedl u jiného
 * vydavatele. Série přitom vzniká psaním do textového pole, takže jediná
 * obrana proti třem podobám téhož názvu je vidět, co už existuje.
 *
 * SÉRIE SVÉ FIRMY JSOU PRVNÍ, zbytek portálu za nimi - prohlížeč v `datalist`
 * drží pořadí, takže co je blíž po ruce, je i výš.
 *
 * KLIENT VIDÍ JEN SVOJE. Objednávkový formulář volá tuhle funkci bez
 * `vsechnySerie`, takže zůstává u série své firmy - cizí názvy knih do
 * klientského portálu nepatří.
 *
 * Nikdy nevyhazuje - detail projektu se kvůli našeptávači nesmí rozbít.
 */
export async function nactiSerieFirmy(
  companyId: string | null | undefined,
  serie?: string | null,
  opts?: {
    /** Nabídnout série z celého portálu, ne jen od téhle firmy (interní stránky). */
    vsechnySerie?: boolean;
  },
): Promise<{ navrhy: string[]; dily: { id: number; name: string; dil: number | null }[] }> {
  const vsechny = opts?.vsechnySerie === true;
  if (!companyId && !vsechny) return { navrhy: [], dily: [] };

  try {
    const radky = await prisma.projectMeta.findMany({
      where: {
        serie: { not: null },
        name: { not: null },
        ...(vsechny ? {} : { companyId }),
      },
      select: { caflouProjectId: true, name: true, serie: true, serieDil: true, companyId: true },
      take: vsechny ? 3000 : 500,
    });

    /**
     * Návrhy: každá série jednou, v té podobě, jak je napsaná poprvé. Nejdřív
     * se projdou řádky téhle firmy, pak zbytek - kdo píše sérii u svého
     * vydavatele, má jeho podobu názvu nahoře.
     */
    const podleKlice = new Map<string, string>();
    const pridej = (r: { serie: string | null }) => {
      const klic = klicSerie(r.serie);
      if (klic && !podleKlice.has(klic)) podleKlice.set(klic, (r.serie ?? '').trim());
    };
    if (companyId) for (const r of radky.filter((r) => r.companyId === companyId)) pridej(r);
    for (const r of radky) pridej(r);

    /**
     * DÍLY SÉRIE. Když projekt firmu navázanou má, berou se díly jen od ní -
     * série patří vydavateli a míchat do jednoho kolečka dvě vydavatelství by
     * byl zmatek. Projekt bez firmy by jinak neměl díly žádné, takže tam se
     * hledá podle názvu série napříč portálem.
     */
    const hledany = klicSerie(serie);
    const dily = hledany
      ? radky
          .filter((r) => klicSerie(r.serie) === hledany)
          .filter((r) => !companyId || r.companyId === companyId)
          .map((r) => ({ id: Number(r.caflouProjectId), name: r.name ?? '', dil: r.serieDil ?? null }))
          .sort((a, b) => {
            if (a.dil != null && b.dil != null) return a.dil - b.dil;
            if (a.dil != null) return -1;
            if (b.dil != null) return 1;
            return a.name.localeCompare(b.name, 'cs');
          })
      : [];

    return {
      navrhy: [...podleKlice.values()],
      dily,
    };
  } catch (err) {
    console.error('Série se nepodařilo načíst:', err);
    return { navrhy: [], dily: [] };
  }
}
