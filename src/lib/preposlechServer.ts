import { prisma } from '@/lib/db';

/**
 * Načtení záznamů přeposlechu (AudioTagger) pro detail projektu - zadání
 * 11. 9. 2026. Stejná data, jaká pak vrací i /api/projekty/[id]/preposlech;
 * tady se čtou na serveru, aby byla záložka hotová hned při otevření.
 */

export type PreposlechStavData = {
  reviewed: boolean;
  reviewedByName: string | null;
  reviewedAt: string | null;
  chyby: {
    id: string;
    trackIndex: number;
    trackName: string;
    localTime: number;
    pdfPage: number | null;
    /** Zvýrazněný úsek textu - { strana, ramecky, text }, viz schema.prisma. */
    zvyrazneni: { strana: number; ramecky: [number, number, number, number][]; text: string } | null;
    description: string;
    createdByName: string | null;
    createdAt: string;
  }[];
};

/**
 * Přehled přeposlechu pro SEZNAM projektů (zadání 12. 9. 2026: sloupce
 * „K přeposlechu" a „Přeposlechnuto" v klientské sekci).
 *
 * Dva dotazy na celý seznam, ne dva na každý projekt — a nikdy se nesahá na
 * Disk: počet stop je uložený z posledního otevření AudioTaggeru, jinak by
 * padesát projektů znamenalo padesát dotazů do Google API při každém otevření
 * přehledu.
 */
export type PreposlechPrehled = {
  /** Kolik stop je v AudioTaggeru nachystaných; 0 = zatím není co poslouchat. */
  stop: number;
  /** Kolik z nich už někdo doposlechl do konce. */
  poslechnuto: number;
  /** Klient klepl na PŘEPOSLECHNUTO. */
  hotovo: boolean;
};

export async function nactiPreposlechPrehled(
  caflouProjectIds: string[],
): Promise<Map<string, PreposlechPrehled>> {
  const prehled = new Map<string, PreposlechPrehled>();
  if (caflouProjectIds.length === 0) return prehled;

  try {
    const [stavy, poslechnute] = await Promise.all([
      prisma.preposlechStav.findMany({
        where: { caflouProjectId: { in: caflouProjectIds } },
        select: { caflouProjectId: true, reviewed: true, pocetStop: true },
      }),
      prisma.preposlechStopa.groupBy({
        by: ['caflouProjectId'],
        where: { caflouProjectId: { in: caflouProjectIds } },
        _count: { _all: true },
      }),
    ]);

    const pocty = new Map(poslechnute.map((p): [string, number] => [p.caflouProjectId, p._count._all]));
    for (const stav of stavy) {
      prehled.set(stav.caflouProjectId, {
        stop: stav.pocetStop,
        poslechnuto: pocty.get(stav.caflouProjectId) ?? 0,
        hotovo: stav.reviewed,
      });
    }
  } catch (err) {
    // Prehled projektu se kvuli preposlechu nesmi rozbit - sloupce zustanou prazdne.
    console.error('Nacteni prehledu preposlechu selhalo:', err);
  }
  return prehled;
}

export async function nactiPreposlech(caflouProjectId: string): Promise<PreposlechStavData> {
  try {
    const [chyby, stav] = await Promise.all([
      prisma.preposlechChyba.findMany({
        where: { caflouProjectId },
        orderBy: [{ trackIndex: 'asc' }, { localTime: 'asc' }],
        take: 2000,
      }),
      prisma.preposlechStav.findUnique({ where: { caflouProjectId } }),
    ]);

    return {
      reviewed: Boolean(stav?.reviewed),
      reviewedByName: stav?.reviewedByName ?? null,
      reviewedAt: stav?.reviewedAt ? stav.reviewedAt.toISOString() : null,
      chyby: chyby.map((ch) => ({
        id: ch.id,
        trackIndex: ch.trackIndex,
        trackName: ch.trackName,
        localTime: ch.localTime,
        pdfPage: ch.pdfPage,
        zvyrazneni: (ch.zvyrazneni as PreposlechStavData['chyby'][number]['zvyrazneni']) ?? null,
        description: ch.description,
        createdByName: ch.createdByName,
        createdAt: ch.createdAt.toISOString(),
      })),
    };
  } catch (err) {
    // Prazdny preposlech nikdy nesmi shodit cely detail projektu.
    console.error('Nacteni preposlechu selhalo:', err);
    return { reviewed: false, reviewedByName: null, reviewedAt: null, chyby: [] };
  }
}
