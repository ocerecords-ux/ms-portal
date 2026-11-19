import { prisma } from '@/lib/db';
import { notifyMany } from '@/lib/notifications';
import { INTERNAL_ROLES } from '@/lib/roles';

/**
 * ZVONEČEK, KDYŽ KLIENT VYPLNÍ TRACKLIST (zadání 19. 11. 2026: „a když přibude
 * tracklist, tak by to mělo jít do zvonečku mi, Peterovi a Helči").
 *
 * JEN ZVONEK, žádný mail ani Bruno. Není to nic, co by se muselo řešit hned -
 * je to zpráva „je to tady, můžeš s tím počítat", a ta patří tam, kam se člověk
 * podívá, až bude mít čas.
 *
 * KOMU, SE ZAŠKRTÁVÁ NA KARTĚ UŽIVATELE (User.tracklistKlienta), ne podle jmen
 * v kódu - stejné pravidlo jako u ostatních zvonků. Když to nemá zaškrtnuté
 * nikdo, neodejde nic.
 *
 * ZVONÍ SE JEN PŘI PŘÍRŮSTKU. Tracklist se ukládá sám po každé vteřině ticha,
 * takže kdyby se zvonilo při každém zápisu, byl by zvonek k ničemu. Volá se
 * proto jen tehdy, když u projektu do té chvíle žádné stopy nebyly - viz
 * lib/tracklistServer.ts.
 *
 * Nikdy nevyhazuje: uložení tracklistu nesmí spadnout kvůli upozornění.
 */
export async function zvonecekONovemTracklistu(
  caflouProjectId: string,
  pocet: number,
  kdo: string | null,
): Promise<void> {
  try {
    const prijemci = (await prisma.user
      .findMany({
        where: { active: true, tracklistKlienta: true, role: { in: INTERNAL_ROLES as never } },
        select: { id: true },
      })
      .catch(() => [])) as unknown as { id: string }[];
    if (prijemci.length === 0) return;

    const meta = (await prisma.projectMeta
      .findUnique({
        where: { caflouProjectId },
        select: { name: true, company: { select: { name: true } }, companyName: true },
      })
      .catch(() => null)) as {
      name: string | null;
      company: { name: string } | null;
      companyName: string | null;
    } | null;

    const projekt = meta?.name || `Projekt ${caflouProjectId}`;
    const firma = meta?.company?.name ?? meta?.companyName ?? null;

    await notifyMany(
      prijemci.map((u) => u.id),
      {
        kind: 'tracklist-od-klienta',
        title: `${projekt}: klient poslal tracklist`,
        body: [firma, kdo?.trim() || null, `${pocet} stop`].filter(Boolean).join(' — '),
        // Zvonek vede rovnou na záložku Tracklist toho projektu.
        url: `/projekty/${encodeURIComponent(caflouProjectId)}?zalozka=tracklist`,
      },
    );
  } catch (err) {
    console.error('Zvoneček o tracklistu od klienta se nepodařilo poslat:', err);
  }
}
