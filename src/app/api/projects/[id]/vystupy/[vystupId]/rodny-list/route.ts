import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { canEditProjectMeta } from '@/lib/roles';
import { prisma } from '@/lib/db';
import { vytvorRodnyListVystupu } from '@/lib/rodnyListServer';

/**
 * RODNÝ LIST K JEDNOMU VÝSTUPU (zadání 26. 9. 2026, rozhodnutí téhož dne:
 * „vlastní RL pro každou délku").
 *
 * Tlačítko u řádku v záložce Výstupy. Stejná práva jako u ostatních interních
 * atributů projektu - produkce a Žůžo-labůžo.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; vystupId: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !canEditProjectMeta(session.user.role)) {
      return NextResponse.json({ error: 'Nemáte oprávnění Rodný list vytvářet.' }, { status: 403 });
    }

    const { id: caflouProjectId, vystupId } = await params;

    const meta = await prisma.projectMeta.findUnique({
      where: { caflouProjectId },
      select: { name: true, statusName: true, company: { select: { caflouCompanyId: true } } },
    });
    const projectName = meta?.name;
    if (!projectName) {
      return NextResponse.json(
        { error: 'Údaje o projektu se nepodařilo načíst, zkuste to prosím za chvíli.' },
        { status: 502 },
      );
    }

    // Výstup musí patřit projektu z adresy - ID z těla se nevěří.
    const vystup = await prisma.vystup.findUnique({
      where: { id: vystupId },
      select: { caflouProjectId: true },
    });
    if (!vystup || vystup.caflouProjectId !== caflouProjectId) {
      return NextResponse.json({ error: 'Výstup nenalezen.' }, { status: 404 });
    }

    const vysledek = await vytvorRodnyListVystupu(
      {
        caflouProjectId,
        projectName,
        statusName: meta?.statusName || '',
        caflouCompanyId: meta?.company?.caflouCompanyId ?? null,
      },
      vystupId,
      session.user.id,
    );

    if (!vysledek.ok) {
      const status =
        vysledek.reason === 'MISSING_FIELDS' || vysledek.reason === 'NOT_RADIO_SPOT' ? 409 : 500;
      return NextResponse.json({ error: vysledek.message }, { status });
    }

    return NextResponse.json({ id: vysledek.rodnyListId, version: vysledek.version });
  } catch (err) {
    console.error('POST /api/projects/[id]/vystupy/[vystupId]/rodny-list selhalo:', err);
    const message = err instanceof Error ? err.message : 'Neznámá chyba.';
    return NextResponse.json(
      { error: `Rodný list se nepodařilo vytvořit (${message}).` },
      { status: 500 },
    );
  }
}
