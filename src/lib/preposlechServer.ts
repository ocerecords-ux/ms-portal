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
    description: string;
    createdByName: string | null;
    createdAt: string;
  }[];
};

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
