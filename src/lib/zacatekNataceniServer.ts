import { prisma } from '@/lib/db';
import { utcParts, zonedToUtc } from '@/lib/calendar';
import { zapisZmenyProjektu } from '@/lib/projektLogServer';
import { posliNotifikaciPoProdleve } from '@/lib/prodlevaNotifikaciServer';
import { zalozKanalProjektu } from '@/lib/kanalProjektuServer';

/**
 * V DEN PRVNÍ FREKVENCE SE PROJEKT PŘEKLOPÍ NA „NATÁČÍME" (zadání
 * 25. 9. 2026: „nastav, že v den, kdy se bude natáčet první frekvence
 * projektu, se automaticky překlopí projekt do stavu Natáčíme, aby se
 * vytvořil i kanál v chatu a viděli to všichni zvukaři").
 *
 * PROČ TO POMÁHÁ: kanál projektu „V přípravě" zvukař v chatu nevidí (viz
 * lib/chatServer.ts) - a to je přesně den, kdy ho potřebuje. Stav se do teď
 * přehazoval ručně a často až zpětně; natáčení přitom v kalendáři stojí
 * dávno dopředu, takže se to dá poznat samo.
 *
 * PŘEKLÁPÍ SE JEN DOPŘEDU. Projekt ve stavu „V přípravě" nebo „Plánujeme" se
 * posune na „Natáčíme"; projekt, který je dál (dotočeno, střih, schvalování),
 * se nechává být - druhá frekvence po měsíci ho nesmí vrátit zpátky.
 *
 * ZDROJE UDÁLOSTÍ jsou dva, stejně jako v kalendáři: potvrzené frekvence
 * z nabídky termínů (RecordingSlot) a ručně zapsané natáčení ve studiu
 * (StudioBlock kind NATACENI). Casting ani střih se nepočítají.
 */
const PASMO = 'Europe/Prague';

/** Stavy, ze kterých se na „Natáčíme" překlápí. */
const PRED_NATACENIM = ['V přípravě', 'Plánujeme'];

export const STAV_NATACIME = 'Natáčíme';

export type VysledekZacatkuNataceni = {
  preklopeno: { caflouProjectId: string; nazev: string | null }[];
  preskoceno: number;
};

/** Dnešek v Praze - od půlnoci do půlnoci, ať se počítá den, ne 24 hodin zpět. */
function dnesek(): { od: Date; do: Date } {
  const casti = utcParts(new Date(), PASMO);
  return {
    od: zonedToUtc(casti.year, casti.month, casti.day, 0, PASMO),
    do: zonedToUtc(casti.year, casti.month, casti.day + 1, 0, PASMO),
  };
}

export async function preklopNaNataceni(): Promise<VysledekZacatkuNataceni> {
  const { od, do: doKdy } = dnesek();

  const [sloty, bloky] = await Promise.all([
    prisma.recordingSlot
      .findMany({
        where: {
          state: { in: ['SELECTED', 'CONFIRMED'] as never },
          start: { gte: od, lt: doKdy },
        },
        select: { request: { select: { caflouProjectId: true } } },
      })
      .catch(() => []),
    prisma.studioBlock
      .findMany({
        where: { kind: 'NATACENI' as never, start: { gte: od, lt: doKdy } },
        select: { caflouProjectId: true },
      })
      .catch(() => []),
  ]);

  const idProjektu = Array.from(
    new Set(
      [
        ...sloty.map((s) => s.request?.caflouProjectId ?? null),
        ...bloky.map((b) => b.caflouProjectId),
      ].filter((id): id is string => Boolean(id)),
    ),
  );
  if (idProjektu.length === 0) return { preklopeno: [], preskoceno: 0 };

  const projekty = await prisma.projectMeta.findMany({
    where: {
      caflouProjectId: { in: idProjektu },
      finished: false,
      statusName: { in: PRED_NATACENIM },
    },
    select: { caflouProjectId: true, name: true, statusName: true, managerUserId: true },
  });

  const preklopeno: VysledekZacatkuNataceni['preklopeno'] = [];
  let preskoceno = idProjektu.length - projekty.length;

  for (const p of projekty) {
    try {
      await prisma.projectMeta.update({
        where: { caflouProjectId: p.caflouProjectId },
        data: { statusName: STAV_NATACIME },
      });
      await zapisZmenyProjektu({
        caflouProjectId: p.caflouProjectId,
        pred: { statusName: p.statusName },
        ulozeno: { statusName: STAV_NATACIME },
        puvodce: { id: null, jmeno: 'Portál (první frekvence)' },
      });

      /**
       * A KANÁL V CHATU, kdyby projekt ještě žádný neměl (starší projekty
       * z doby, kdy se kanál zakládal až prvním otevřením). Zakladatelem je
       * manažer projektu, když je vyplněný - jinak kanál vznikne bez členů
       * a tým ho vidí tak jako tak.
       */
      if (p.managerUserId) {
        await zalozKanalProjektu({
          caflouProjectId: p.caflouProjectId,
          nazev: p.name || `Projekt ${p.caflouProjectId}`,
          zakladatelId: p.managerUserId,
          managerUserId: p.managerUserId,
        });
      }

      // Zpráva klientovi jen tam, kde si to firma u tohohle stavu přeje.
      posliNotifikaciPoProdleve(p.caflouProjectId, STAV_NATACIME);
      preklopeno.push({ caflouProjectId: p.caflouProjectId, nazev: p.name });
    } catch (err) {
      console.error(`Preklopeni projektu ${p.caflouProjectId} na "${STAV_NATACIME}" selhalo:`, err);
      preskoceno += 1;
    }
  }

  return { preklopeno, preskoceno };
}
