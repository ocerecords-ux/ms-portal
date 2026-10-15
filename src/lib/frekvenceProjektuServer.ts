import { prisma } from '@/lib/db';

/**
 * TERMÍNY NATÁČENÍ PROJEKTU (připomínka Helči 15. 10. 2026).
 *
 * FREKVENCE JSOU NA DVOU MÍSTECH a obě se musí počítat, jinak zůstane
 * polovina projektů prázdná:
 *
 *   RecordingSlot (SELECTED / CONFIRMED) - herec si vybral termín z nabídky
 *   StudioBlock (kind NATACENI)          - produkce zapsala natáčení rovnou
 *                                          do kalendáře
 *
 * Do přehledu jde jen PRVNÍ TERMÍN A POČET - jedno kolečko do databáze na
 * celý seznam, ne na projekt. Celý rozpis se čte až po otevření okénka
 * u názvu, stejně jako díly série.
 */

/** Co o projektu ví přehled - na ikonu, bublinu a řazení. */
export type PrvniFrekvence = {
  /** Nejbližší NEODBYTÁ frekvence; když už všechny proběhly, ta poslední. */
  prvni: string;
  /** Opravdu první frekvence projektu - podle ní se řadí. */
  zacatek: string;
  pocet: number;
};

type Udalost = { start: Date; projekt: string };

/** Vybrané frekvence obou druhů, bez ohledu na herce. */
async function nactiUdalosti(idProjektu: string[]): Promise<Udalost[]> {
  if (idProjektu.length === 0) return [];
  const [sloty, bloky] = await Promise.all([
    prisma.recordingSlot
      .findMany({
        where: {
          state: { in: ['SELECTED', 'CONFIRMED'] as never },
          request: { caflouProjectId: { in: idProjektu } },
        },
        select: { start: true, request: { select: { caflouProjectId: true } } },
      })
      .catch(() => []),
    prisma.studioBlock
      .findMany({
        where: { kind: 'NATACENI', caflouProjectId: { in: idProjektu } },
        select: { start: true, caflouProjectId: true },
      })
      .catch(() => []),
  ]);

  const vysledek: Udalost[] = [];
  for (const s of sloty as { start: Date; request: { caflouProjectId: string | null } }[]) {
    const projekt = (s.request?.caflouProjectId ?? '').trim();
    if (projekt) vysledek.push({ start: s.start, projekt });
  }
  for (const b of bloky as { start: Date; caflouProjectId: string | null }[]) {
    const projekt = (b.caflouProjectId ?? '').trim();
    if (projekt) vysledek.push({ start: b.start, projekt });
  }
  return vysledek;
}

/**
 * Pro celý seznam projektů naráz.
 *
 * `prvni` je NEJBLIŽŠÍ NEODBYTÁ frekvence, ne nejstarší: u rozdělaného
 * projektu zajímá produkci, co přijde, ne co už bylo. Když je všechno za
 * námi, vrací se poslední - ikona pak zešedne a říká „tady se už točilo".
 */
export async function nactiPrvniFrekvence(
  idProjektu: string[],
  ted: Date = new Date(),
): Promise<Map<string, PrvniFrekvence>> {
  const udalosti = await nactiUdalosti(idProjektu);
  const podleProjektu = new Map<string, Date[]>();
  for (const u of udalosti) {
    const seznam = podleProjektu.get(u.projekt);
    if (seznam) seznam.push(u.start);
    else podleProjektu.set(u.projekt, [u.start]);
  }

  const vysledek = new Map<string, PrvniFrekvence>();
  for (const [projekt, casy] of podleProjektu) {
    casy.sort((a, b) => a.getTime() - b.getTime());
    const nadchazejici = casy.find((c) => c.getTime() >= ted.getTime());
    vysledek.set(projekt, {
      prvni: (nadchazejici ?? casy[casy.length - 1]).toISOString(),
      zacatek: casy[0].toISOString(),
      pocet: casy.length,
    });
  }
  return vysledek;
}

/** Jedna frekvence v rozpisu u názvu projektu. */
export type FrekvenceVRozpisu = {
  id: string;
  start: string;
  end: string;
  studio: string;
};

/** Rozpis jednoho herce - u dvou herců jsou vedle sebe dva sloupce. */
export type RozpisHerce = {
  herec: string;
  frekvence: FrekvenceVRozpisu[];
};

/**
 * CELÝ ROZPIS JEDNOHO PROJEKTU, rozdělený po hercích (zadání 15. 10. 2026:
 * „když tam budou dva herci, tak to bude ve dvou sloupcích").
 *
 * Každý herec má vlastní sloupec a vlastní číslování: natáčí se nezávisle,
 * často v jiném studiu a jiný týden, takže jeden slepený seznam by nedával
 * smysl. Sloupce jsou seřazené podle toho, kdo začíná dřív.
 *
 * Herec bez jména (starší ručně zapsaná událost) spadne do jednoho sloupce
 * bez hlavičky - radši bez jména než zahodit termín.
 */
export async function nactiRozpisProjektu(caflouProjectId: string): Promise<RozpisHerce[]> {
  const [sloty, bloky] = await Promise.all([
    prisma.recordingSlot
      .findMany({
        where: {
          state: { in: ['SELECTED', 'CONFIRMED'] as never },
          request: { caflouProjectId },
        },
        select: {
          id: true,
          start: true,
          end: true,
          studio: { select: { shortName: true, name: true } },
          request: { select: { actorName: true, actor: { select: { name: true, email: true } } } },
        },
      })
      .catch(() => []),
    prisma.studioBlock
      .findMany({
        where: { kind: 'NATACENI', caflouProjectId },
        select: {
          id: true,
          start: true,
          end: true,
          actorName: true,
          studio: { select: { shortName: true, name: true } },
        },
      })
      .catch(() => []),
  ]);

  type Radek = { id: string; start: Date; end: Date; studio: string; herec: string };
  const radky: Radek[] = [];

  for (const s of sloty as {
    id: string;
    start: Date;
    end: Date;
    studio: { shortName: string | null; name: string } | null;
    request: { actorName: string | null; actor: { name: string | null; email: string } | null } | null;
  }[]) {
    radky.push({
      id: s.id,
      start: s.start,
      end: s.end,
      studio: s.studio?.shortName || s.studio?.name || '',
      herec: (s.request?.actor?.name || s.request?.actor?.email || s.request?.actorName || '').trim(),
    });
  }
  for (const b of bloky as {
    id: string;
    start: Date;
    end: Date;
    actorName: string | null;
    studio: { shortName: string | null; name: string } | null;
  }[]) {
    radky.push({
      id: b.id,
      start: b.start,
      end: b.end,
      studio: b.studio?.shortName || b.studio?.name || '',
      herec: (b.actorName ?? '').trim(),
    });
  }

  const podleHerce = new Map<string, Radek[]>();
  for (const r of radky) {
    const seznam = podleHerce.get(r.herec);
    if (seznam) seznam.push(r);
    else podleHerce.set(r.herec, [r]);
  }

  const rozpisy: RozpisHerce[] = [...podleHerce.entries()].map(([herec, seznam]) => {
    seznam.sort((a, b) => a.start.getTime() - b.start.getTime());
    return {
      herec,
      frekvence: seznam.map((r) => ({
        id: r.id,
        start: r.start.toISOString(),
        end: r.end.toISOString(),
        studio: r.studio,
      })),
    };
  });

  // Kdo začíná dřív, je vlevo.
  rozpisy.sort((a, b) => {
    const av = a.frekvence[0]?.start ?? '';
    const bv = b.frekvence[0]?.start ?? '';
    return av.localeCompare(bv);
  });
  return rozpisy;
}
