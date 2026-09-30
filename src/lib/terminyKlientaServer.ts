import { prisma } from '@/lib/db';

/**
 * NATÁČECÍ TERMÍNY PRO KLIENTA (zadání 30. 9. 2026: „potřebuji udělat, aby
 * klienti viděli všechny natáčecí frekvence s hercem").
 *
 * Klient do teď viděl jen progres natáčení v procentech - kdy se jeho kniha
 * točí a s kým, se z portálu nedozvěděl a ptal se mailem. Tohle je ta
 * odpověď: seznam termínů u jeho zakázky.
 *
 * DVA ZDROJE, PROTOŽE NATÁČENÍ VZNIKÁ DVĚMA CESTAMI:
 *  - u audioknihy potvrzená frekvence z nabídky termínů (RecordingSlot),
 *  - u reklamy událost zapsaná rovnou do kalendáře studia (StudioBlock).
 * Klient ten rozdíl neřeší, takže se to slévá do jednoho seznamu podle času.
 *
 * KLIENTOVI SE UKAZUJE JEN TO, CO PLATÍ. Nabídky, ze kterých si herec teprve
 * vybírá, a zrušené termíny do přehledu nepatří - klient by se ptal na něco,
 * co se ještě změní.
 */

export type TerminKlienta = {
  id: string;
  start: string;
  end: string;
  /** Kdo v ten den točí. Prázdné u událostí bez zapsaného herce. */
  herec: string | null;
  studio: string;
  /** Termín už je za námi - v seznamu se odliší. */
  odtoceno: boolean;
};

/**
 * Termíny k zakázkám, seřazené od nejbližšího. Čte se hromadně pro celý
 * přehled projektů - jeden dotaz na obě tabulky místo dotazu na řádek.
 */
export async function nactiTerminyProjektu(
  caflouProjectIds: string[],
): Promise<Record<string, TerminKlienta[]>> {
  if (caflouProjectIds.length === 0) return {};

  try {
    const [sloty, bloky] = await Promise.all([
      prisma.recordingSlot.findMany({
        where: {
          state: 'CONFIRMED',
          request: { caflouProjectId: { in: caflouProjectIds } },
        },
        orderBy: { start: 'asc' },
        select: {
          id: true,
          start: true,
          end: true,
          studio: { select: { name: true } },
          request: { select: { caflouProjectId: true, actorName: true } },
        },
      }),
      prisma.studioBlock.findMany({
        where: { kind: 'NATACENI', caflouProjectId: { in: caflouProjectIds } },
        orderBy: { start: 'asc' },
        select: {
          id: true,
          start: true,
          end: true,
          actorName: true,
          caflouProjectId: true,
          studio: { select: { name: true } },
        },
      }),
    ]);

    const ted = Date.now();
    const podleProjektu: Record<string, TerminKlienta[]> = {};
    const pridej = (projekt: string | null, t: TerminKlienta) => {
      if (!projekt) return;
      (podleProjektu[projekt] ??= []).push(t);
    };

    for (const s of sloty as unknown as {
      id: string;
      start: Date;
      end: Date;
      studio: { name: string };
      request: { caflouProjectId: string; actorName: string };
    }[]) {
      pridej(s.request.caflouProjectId, {
        id: `slot-${s.id}`,
        start: s.start.toISOString(),
        end: s.end.toISOString(),
        herec: s.request.actorName || null,
        studio: s.studio.name,
        odtoceno: s.end.getTime() < ted,
      });
    }

    for (const b of bloky as unknown as {
      id: string;
      start: Date;
      end: Date;
      actorName: string | null;
      caflouProjectId: string | null;
      studio: { name: string };
    }[]) {
      pridej(b.caflouProjectId, {
        id: `blok-${b.id}`,
        start: b.start.toISOString(),
        end: b.end.toISOString(),
        herec: b.actorName || null,
        studio: b.studio.name,
        odtoceno: b.end.getTime() < ted,
      });
    }

    for (const seznam of Object.values(podleProjektu)) {
      seznam.sort((a, b) => a.start.localeCompare(b.start));
    }
    return podleProjektu;
  } catch (err) {
    console.error('Načtení natáčecích termínů pro klienta selhalo:', err);
    return {};
  }
}
