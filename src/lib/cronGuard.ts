import type { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/adminGuard';

/**
 * KDO SMÍ SPUSTIT ÚLOHU (oprava 24. 9. 2026: „za deset minut mám událost
 * a Bruno mi to nepřipomněl").
 *
 * Všechny úlohy z vercel.json se každých pár minut poctivě volaly - a portál
 * jim VŠEM odpovídal 403. Důvod: kontrola čekala `Authorization: Bearer
 * CRON_SECRET`, jenže ta proměnná v prostředí nikdy nevznikla. Bez ní Vercel
 * žádnou hlavičku neposílá, takže se úloha tvářila jako cizí návštěva.
 * Tiše tím přestaly chodit připomínky před událostmi, ranní přehledy, nabídky
 * výkazů, hlídání nových stop i párování banky.
 *
 * TŘI CESTY DOVNITŘ:
 *  1. `Authorization: Bearer CRON_SECRET`, když je tajemství nastavené -
 *     to je ta správná cesta a jakmile proměnná v Vercelu je, platí jen ona.
 *  2. Hlavička `x-vercel-cron`, kterou k úloze přidává sám Vercel - záchranná
 *     brzda pro případ, že tajemství chybí. Bez ní by portál po nasazení do
 *     nového prostředí zase tiše mlčel a nikdo by si toho týden nevšiml.
 *  3. Přihlášené Žůžo-labůžo, když si chce úlohu pustit ručně.
 *
 * Co může přijít zvenčí: kdyby někdo hlavičku napodobil, spustí nanejvýš
 * úlohu, kterou portál stejně sám pouští každých pár minut - všechny jsou
 * psané tak, aby opakované spuštění nic nezdvojilo.
 */
export async function smiSpustitUlohu(req: NextRequest): Promise<boolean> {
  const tajemstvi = process.env.CRON_SECRET;
  if (tajemstvi) {
    if (req.headers.get('authorization') === `Bearer ${tajemstvi}`) return true;
  } else if (req.headers.get('x-vercel-cron')) {
    return true;
  }
  return Boolean(await requireAdmin());
}
