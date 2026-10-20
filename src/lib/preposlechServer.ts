import { prisma } from '@/lib/db';
import { spocitejPostup } from '@/lib/preposlechPostup';

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
  /** Pořadí stop (od 1), které přeposlouchávač odškrtl jako hotové. */
  hotoveStopy: number[];
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
  /**
   * Kolik záznamů chyb už u projektu je (zadání 25. 9. 2026: „chtělo by to
   * nějakou ikonu, že se částečně zapisují chyby v AudioTaggeru"). Podle toho
   * se pozná rozdělaný přeposlech i tam, kde poslech běží bez otevřeného
   * textu a procenta zůstávají prázdná.
   */
  chyb: number;
  /**
   * Kolik procent textu klient přeposlechl - podle stran PDF (21. 9. 2026).
   * null = text ještě nikdo neotevřel, stran nevíme.
   */
  procent: number | null;
};

export async function nactiPreposlechPrehled(
  caflouProjectIds: string[],
  /**
   * KLIENTSKÝ PŘEHLED (zadání 20. 10. 2026: interní přeposlech „by neměl
   * vidět klient"). Pak se do počtu poznámek nezapočítají ty naše a hotovo
   * znamená jen klientovo odškrtnutí - jinak by mu u zakázky svítilo, že má
   * přeposlechnuto, protože jsme si ji poslechli my.
   */
  proKlienta = false,
): Promise<Map<string, PreposlechPrehled>> {
  const prehled = new Map<string, PreposlechPrehled>();
  if (caflouProjectIds.length === 0) return prehled;

  try {
    const [stavy, poslechnute, zaznamy] = await Promise.all([
      prisma.preposlechStav.findMany({
        where: { caflouProjectId: { in: caflouProjectIds } },
        select: {
          caflouProjectId: true,
          reviewed: true,
          interniReviewed: true,
          pocetStop: true,
          slyseneStrany: true,
          slyseneStranyZ: true,
          textStran: true,
        },
      }),
      prisma.preposlechStopa.groupBy({
        by: ['caflouProjectId'],
        where: { caflouProjectId: { in: caflouProjectIds } },
        _count: { _all: true },
      }),
      // Zapsane chyby (25. 9. 2026) - jeden dotaz na cely seznam.
      prisma.preposlechChyba.groupBy({
        by: ['caflouProjectId'],
        where: {
          caflouProjectId: { in: caflouProjectIds },
          ...(proKlienta ? { interni: false } : {}),
        },
        _count: { _all: true },
      }),
    ]);

    const pocty = new Map(poslechnute.map((p): [string, number] => [p.caflouProjectId, p._count._all]));
    const poctyChyb = new Map(zaznamy.map((z): [string, number] => [z.caflouProjectId, z._count._all]));
    for (const stav of stavy) {
      prehled.set(stav.caflouProjectId, {
        stop: stav.pocetStop,
        poslechnuto: pocty.get(stav.caflouProjectId) ?? 0,
        hotovo: stav.reviewed || (!proKlienta && Boolean(stav.interniReviewed)),
        chyb: poctyChyb.get(stav.caflouProjectId) ?? 0,
        procent: spocitejPostup(stav.slyseneStrany ?? [], stav.slyseneStranyZ ?? stav.textStran)?.procent ?? null,
      });
    }

    /**
     * Projekt, kde uz nekdo chyby zapisuje, ale PreposlechStav jeste nevznikl
     * (stopy se cetly drive, nez se stav zalozil), by jinak vypadl uplne -
     * a prave o nem ta ikona ma mluvit.
     */
    for (const z of zaznamy) {
      if (prehled.has(z.caflouProjectId)) continue;
      prehled.set(z.caflouProjectId, {
        stop: 0,
        poslechnuto: pocty.get(z.caflouProjectId) ?? 0,
        hotovo: false,
        chyb: z._count._all,
        procent: null,
      });
    }
  } catch (err) {
    // Prehled projektu se kvuli preposlechu nesmi rozbit - sloupce zustanou prazdne.
    console.error('Nacteni prehledu preposlechu selhalo:', err);
  }
  return prehled;
}

/**
 * KAŽDÁ STRANA VIDÍ SVOU (zadání 20. 10. 2026: „když budeme poslouchat některé
 * knihy interně nebo si interně v portálu značit něco, tak by to neměl vidět
 * klient"). Tohle je první vykreslení AudioTaggeru ze serveru; dál už se stav
 * čte z /api/projekty/[id]/preposlech, kde se dělí stejně - viz komentář
 * u funkce `stav` v té routě.
 */
export async function nactiPreposlech(
  caflouProjectId: string,
  /** Čte to klient (účtem nebo odkazem z mailu)? Pak bez našich zápisů. */
  proKlienta = false,
): Promise<PreposlechStavData> {
  try {
    const [chyby, stav, hotove] = await Promise.all([
      prisma.preposlechChyba.findMany({
        where: { caflouProjectId, ...(proKlienta ? { interni: false } : {}) },
        orderBy: [{ trackIndex: 'asc' }, { localTime: 'asc' }],
        take: 2000,
      }),
      prisma.preposlechStav.findUnique({ where: { caflouProjectId } }),
      // Odskrtnute stopy (zadani 14. 9. 2026) - jen poradi, nic vic z nich
      // AudioTagger nepotrebuje. Nase odskrtnuti ma vlastni pole, takze
      // klientovi stopy nezezelenaji nasi kontrolou (20. 10. 2026).
      prisma.preposlechStopa.findMany({
        where: proKlienta
          ? { caflouProjectId, hotovoAt: { not: null } }
          : { caflouProjectId, hotovoInterniAt: { not: null } },
        select: { trackIndex: true },
      }),
    ]);

    const naseHotovo = !proKlienta && Boolean(stav?.interniReviewed);
    const klientHotovo = Boolean(stav?.reviewed);
    const kdyHotovo = klientHotovo ? stav?.reviewedAt : naseHotovo ? stav?.interniReviewedAt : null;

    return {
      reviewed: klientHotovo || naseHotovo,
      reviewedByName: klientHotovo
        ? (stav?.reviewedByName ?? null)
        : naseHotovo
          ? (stav?.interniReviewedByName ?? null)
          : null,
      reviewedAt: kdyHotovo ? kdyHotovo.toISOString() : null,
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
      hotoveStopy: hotove.map((h) => h.trackIndex),
    };
  } catch (err) {
    // Prazdny preposlech nikdy nesmi shodit cely detail projektu.
    console.error('Nacteni preposlechu selhalo:', err);
    return { reviewed: false, reviewedByName: null, reviewedAt: null, chyby: [], hotoveStopy: [] };
  }
}
