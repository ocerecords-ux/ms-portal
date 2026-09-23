import { prisma } from '@/lib/db';
import { brunoNapisSoukrome } from '@/lib/brunoOznameni';
import { posliPush } from '@/lib/pushServer';
import { udalostiCloveka } from '@/lib/ranniPrehledServer';
import { INTERNAL_ROLES } from '@/lib/roles';

/**
 * PŘIPOMÍNKA 15 MINUT PŘED UDÁLOSTÍ (zadání 23. 9. 2026: „a Bruno mi to
 * připomene zprávou 15 min. před událostí").
 *
 * Bruno napíše do soukromé konverzace a zároveň cinkne upozornění do
 * telefonu. Tohle do chatu patří: je to jedna věta těsně před akcí, ne ranní
 * seznam, který se v chatu ztratil.
 *
 * ÚLOHA BĚŽÍ KAŽDÝCH PĚT MINUT a bere okno 10-20 minut dopředu, ať se
 * událost netrefí mezi dvě spuštění. Aby připomínka nechodila pokaždé znovu,
 * odeslané se zapisují do PripomenutaUdalost - klíč je člověk + událost.
 *
 * KOMU: kdo má zapnutý přehled dne (Můj účet). Je to tentýž vypínač - kdo
 * chce, aby mu Bruno hlídal den, chce i štouchnutí před natáčením.
 */

/** Okno dopředu, ve kterém se událost považuje za „za chvíli". */
const OD_MINUT = 10;
const DO_MINUT = 20;

export type VysledekPripominek = { odeslano: number; lidi: number };

export async function posliPripominkyUdalosti(
  options: { odMinut?: number; doMinut?: number } = {},
): Promise<VysledekPripominek> {
  const ted = new Date();
  const od = new Date(ted.getTime() + (options.odMinut ?? OD_MINUT) * 60_000);
  const doKdy = new Date(ted.getTime() + (options.doMinut ?? DO_MINUT) * 60_000);

  const lide = await prisma.user
    .findMany({
      where: { active: true, ranniPrehled: true, role: { in: INTERNAL_ROLES as never } },
      select: { id: true, email: true },
    })
    .catch(() => []);

  let odeslano = 0;

  for (const clovek of lide) {
    try {
      /**
       * Načítá se celý den a teprve pak se vybírá, co začíná v okně. Kdyby se
       * ptalo rovnou na okno, vypadly by z něj vícedenní bloky a porady, které
       * se dopočítávají z opakování - a právě na těch záleží.
       */
      const denOd = new Date(ted.getTime() - 12 * 3600_000);
      const denDo = new Date(ted.getTime() + 24 * 3600_000);
      const udalosti = await udalostiCloveka(clovek.id, denOd, denDo);

      for (const u of udalosti.filter((x) => x.start >= od && x.start < doKdy)) {
        const klic = `${clovek.id}:${u.klic}:${u.start.toISOString()}`;
        // Unikátní klíč je pojistka i proti dvěma úlohám naráz: druhý zápis
        // spadne a připomínka se neodešle dvakrát.
        const zapsano = await prisma.pripomenutaUdalost
          .create({ data: { klic } })
          .then(() => true)
          .catch(() => false);
        if (!zapsano) continue;

        await brunoNapisSoukrome(clovek.id, `Za 15 minut: ${u.cas} — ${u.popis}`).catch(() => false);
        await posliPush([clovek.id], {
          titulek: 'Za 15 minut',
          text: `${u.cas} — ${u.popis}`,
          odkaz: '/kalendar',
          znacka: `pripominka-${u.klic}`,
        });
        odeslano += 1;
      }
    } catch (err) {
      console.error(`Pripominky pro ${clovek.email} selhaly:`, err);
    }
  }

  // Úklid starých záznamů, ať tabulka neroste donekonečna. Týden zpátky
  // bohatě stačí - připomínky se posílají dvacet minut dopředu.
  await prisma.pripomenutaUdalost
    .deleteMany({ where: { createdAt: { lt: new Date(ted.getTime() - 7 * 24 * 3600_000) } } })
    .catch(() => undefined);

  return { odeslano, lidi: lide.length };
}
