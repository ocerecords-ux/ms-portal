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
  /**
   * KDE SE TEN DEN SKONČILO (zadání 1. 10. 2026: „po tom rozkliknutí by bylo
   * super, kdyby byly zaznačeny strany v pdf, na které se v ten den
   * skončilo"). Strana režijního editu ze zápisu zvukaře (BrunoNatoceno).
   * Null, dokud za ten den žádný zápis není - typicky u budoucích termínů.
   */
  stranaDo: number | null;
  /**
   * Odkud se ten den začalo - strana po té, kde se skončilo minule (u téhož
   * herce). Null u prvního zápisu: kde herec v knize začíná, nevíme, u knihy
   * s víc herci to není první strana.
   */
  stranaOd: number | null;
};

/** Termín s hercem, než se z něj udělá to, co vidí klient. */
type TerminVnitrne = TerminKlienta & { actorUserId: string | null };

/**
 * PŘIŘAZENÍ ZÁPISŮ K TERMÍNŮM. Zvukař píše do chatu „skončili jsme na straně
 * 141" a Bruno z toho udělá řádek s časem zápisu - ne s datem natáčení. Zápis
 * tedy patří POSLEDNÍ FREKVENCI, KTERÁ ZAČALA PŘED NÍM: ať ho zvukař napíše
 * během natáčení, večer po něm, nebo až druhý den ráno, sedne na tu správnou.
 *
 * U knihy s víc herci se bere ohled na herce: zápis s hercem padne jen na
 * frekvence toho herce. Zápis bez herce (projekt s jediným hercem, kde ho
 * Bruno neurčil) padne na kteroukoliv.
 */
function priradStrany(
  terminy: TerminVnitrne[],
  zapisy: { userId: string | null; strana: number; createdAt: Date }[],
): void {
  for (const z of zapisy) {
    let cil: TerminVnitrne | null = null;
    for (const t of terminy) {
      if (new Date(t.start).getTime() > z.createdAt.getTime()) break;
      if (z.userId && t.actorUserId && t.actorUserId !== z.userId) continue;
      cil = t;
    }
    // Vyšší strana vyhrává: za jeden den se do chatu napíše i víc zápisů
    // a platí ten nejdál v textu.
    if (cil && (cil.stranaDo == null || z.strana > cil.stranaDo)) cil.stranaDo = z.strana;
  }

  // Odkud se ten den začalo - tam, kde se u téhož herce minule skončilo.
  const posledni = new Map<string, number>();
  for (const t of terminy) {
    const klic = t.actorUserId ?? '';
    const predchozi = posledni.get(klic);
    if (t.stranaDo == null) continue;
    if (predchozi != null && predchozi < t.stranaDo) t.stranaOd = predchozi + 1;
    posledni.set(klic, t.stranaDo);
  }
}

/**
 * Termíny k zakázkám, seřazené od nejbližšího. Čte se hromadně pro celý
 * přehled projektů - jeden dotaz na obě tabulky místo dotazu na řádek.
 */
export async function nactiTerminyProjektu(
  caflouProjectIds: string[],
): Promise<Record<string, TerminKlienta[]>> {
  if (caflouProjectIds.length === 0) return {};

  try {
    const [sloty, bloky, zapisy] = await Promise.all([
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
          request: { select: { caflouProjectId: true, actorName: true, actorUserId: true } },
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
          actorUserId: true,
          caflouProjectId: true,
          studio: { select: { name: true } },
        },
      }),
      /**
       * Zápisy zvukařů „skončili jsme na straně N" (BrunoNatoceno). Jeden
       * dotaz na celou stránku, přiřazení k termínům viz priradStrany.
       */
      prisma.brunoNatoceno
        .findMany({
          where: { caflouProjectId: { in: caflouProjectIds } },
          orderBy: { createdAt: 'asc' },
          select: { caflouProjectId: true, userId: true, strana: true, createdAt: true },
        })
        .catch(
          () => [] as { caflouProjectId: string; userId: string | null; strana: number; createdAt: Date }[],
        ),
    ]);

    const ted = Date.now();
    const podleProjektu: Record<string, TerminVnitrne[]> = {};
    const pridej = (projekt: string | null, t: TerminVnitrne) => {
      if (!projekt) return;
      (podleProjektu[projekt] ??= []).push(t);
    };

    for (const s of sloty as unknown as {
      id: string;
      start: Date;
      end: Date;
      studio: { name: string };
      request: { caflouProjectId: string; actorName: string; actorUserId: string | null };
    }[]) {
      pridej(s.request.caflouProjectId, {
        id: `slot-${s.id}`,
        start: s.start.toISOString(),
        end: s.end.toISOString(),
        herec: s.request.actorName || null,
        studio: s.studio.name,
        odtoceno: s.end.getTime() < ted,
        stranaDo: null,
        stranaOd: null,
        actorUserId: s.request.actorUserId ?? null,
      });
    }

    for (const b of bloky as unknown as {
      id: string;
      start: Date;
      end: Date;
      actorName: string | null;
      actorUserId: string | null;
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
        stranaDo: null,
        stranaOd: null,
        actorUserId: b.actorUserId ?? null,
      });
    }

    // Zapisy podle projektu, at se priradStrany dela jednou za projekt.
    const zapisyProjektu = new Map<
      string,
      { userId: string | null; strana: number; createdAt: Date }[]
    >();
    for (const z of zapisy as unknown as {
      caflouProjectId: string;
      userId: string | null;
      strana: number;
      createdAt: Date;
    }[]) {
      const seznam = zapisyProjektu.get(z.caflouProjectId) ?? [];
      seznam.push({ userId: z.userId ?? null, strana: z.strana, createdAt: z.createdAt });
      zapisyProjektu.set(z.caflouProjectId, seznam);
    }

    const vysledek: Record<string, TerminKlienta[]> = {};
    for (const [projekt, seznam] of Object.entries(podleProjektu)) {
      seznam.sort((a, b) => a.start.localeCompare(b.start));
      priradStrany(seznam, zapisyProjektu.get(projekt) ?? []);
      // Herec jako id ven nechodi - klientovi je k nicemu a nema ho proc znat.
      vysledek[projekt] = seznam.map((t) => ({
        id: t.id,
        start: t.start,
        end: t.end,
        herec: t.herec,
        studio: t.studio,
        odtoceno: t.odtoceno,
        stranaDo: t.stranaDo,
        stranaOd: t.stranaOd,
      }));
    }
    return vysledek;
  } catch (err) {
    console.error('Načtení natáčecích termínů pro klienta selhalo:', err);
    return {};
  }
}
