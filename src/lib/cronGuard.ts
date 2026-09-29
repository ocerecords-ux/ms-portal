import type { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/adminGuard';

/**
 * KDO SMÍ SPUSTIT ÚLOHU (oprava 24. 9. 2026: „za deset minut mám událost
 * a Bruno mi to nepřipomněl", znovu 29. 9. 2026: „Bruno mě neupozornil zase,
 * že mám ve 14:00 teď režii v Praze. Proč to pořád nefunguje?!").
 *
 * Všechny úlohy z vercel.json se každých pár minut poctivě volaly - a portál
 * jim VŠEM odpovídal 403. Důvod: kontrola čekala `Authorization: Bearer
 * CRON_SECRET`, jenže ta proměnná v prostředí nikdy nevznikla. Bez ní Vercel
 * žádnou hlavičku neposílá, takže se úloha tvářila jako cizí návštěva.
 * Tiše tím přestaly chodit připomínky před událostmi, ranní přehledy, nabídky
 * výkazů, hlídání nových stop i párování banky.
 *
 * PODRUHÉ TOTÉŽ: záchranná brzda z 24. 9. hlídala hlavičku `x-vercel-cron`,
 * jenže tu Vercel neposílá - to byl jen dohad a nikdo ho neověřil, takže
 * úlohy dál pět dní mlčely. V logu je vidět, čím se úloha OPRAVDU pozná:
 *
 *     User Agent: vercel-cron/1.0
 *     Firewall: Allowed · Middleware: 200 · Function: 403
 *
 * Podle toho se to teď pozná a hlavička zůstává jen jako druhá možnost,
 * kdyby ji Vercel někdy začal posílat.
 *
 * TŘI CESTY DOVNITŘ:
 *  1. `Authorization: Bearer CRON_SECRET`, když je tajemství nastavené -
 *     to je ta správná cesta a jakmile proměnná ve Vercelu je, platí jen ona.
 *  2. Úloha z Vercelu poznaná podle sebe sama (user agent, nebo hlavička) -
 *     záchranná brzda pro případ, že tajemství chybí. Bez ní by portál po
 *     nasazení do nového prostředí zase tiše mlčel.
 *  3. Přihlášené Žůžo-labůžo, když si chce úlohu pustit ručně.
 *
 * Co může přijít zvenčí: kdyby někdo user agenta napodobil, spustí nanejvýš
 * úlohu, kterou portál stejně sám pouští každých pár minut - všechny jsou
 * psané tak, aby opakované spuštění nic nezdvojilo. Přesto je lepší
 * CRON_SECRET nastavit; pak tahle cesta nikam nevede.
 */

/** Pozná úlohu Vercelu podle toho, čím se hlásí. */
function jdeOdVercelu(req: NextRequest): boolean {
  if (req.headers.get('x-vercel-cron')) return true;
  return (req.headers.get('user-agent') ?? '').toLowerCase().startsWith('vercel-cron/');
}

export async function smiSpustitUlohu(req: NextRequest): Promise<boolean> {
  const tajemstvi = process.env.CRON_SECRET;
  if (tajemstvi) {
    if (req.headers.get('authorization') === `Bearer ${tajemstvi}`) return true;
    /**
     * Tajemství je nastavené, ale nesedí - a volá to Vercel. To je přesně ten
     * tichý stav, kvůli kterému úlohy dvakrát týdny mlčely, takže ať je o něm
     * v logu věta. Dovnitř se tudy nejde: špatné tajemství se neobchází.
     */
    if (jdeOdVercelu(req)) {
      console.error(
        'Uloha z Vercelu prisla se spatnym CRON_SECRET - zkontrolujte promennou v projektu a nasadte znovu (promenne se pecou pri nasazeni).',
      );
    }
  } else if (jdeOdVercelu(req)) {
    return true;
  }
  return Boolean(await requireAdmin());
}
