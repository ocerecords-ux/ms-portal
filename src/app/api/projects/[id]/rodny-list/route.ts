import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { canEditProjectMeta } from '@/lib/roles';
import { findCaflouProjectInList, getCaflouProject } from '@/lib/caflou';
import { znovuVytvorRodnyList } from '@/lib/rodnyListServer';

/**
 * Řízené znovuvygenerování Rodného listu (tlačítko „Vygenerovat RL znovu")
 * - zadání 9. 9. 2026.
 *
 * Automatika novou verzi sama nedělá, právě aby při opakovaném otevření
 * projektu nevznikaly duplicity. Tohle je jediná cesta, jak vyrobit další
 * verzi - typicky po opravě údajů. Smí to Produkce a Žůžo-labůžo, stejně
 * jako u ostatních interních atributů projektu.
 */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !canEditProjectMeta(session.user.role)) {
      return NextResponse.json({ error: 'Nemáte oprávnění Rodný list vytvářet.' }, { status: 403 });
    }

    const caflouProjectId = params.id;
    const caflou = (await getCaflouProject(caflouProjectId)) ?? (await findCaflouProjectInList(caflouProjectId));
    if (!caflou?.project) {
      return NextResponse.json(
        { error: 'Údaje o projektu se nepodařilo načíst z Caflou, zkuste to prosím za chvíli.' },
        { status: 502 },
      );
    }

    const vysledek = await znovuVytvorRodnyList(
      {
        caflouProjectId,
        projectName: caflou.project.name,
        statusName: caflou.project.statusName,
        caflouCompanyId: caflou.caflouCompanyId ?? null,
      },
      session.user.id,
    );

    if (!vysledek.ok) {
      // Chybějící údaje jsou chyba zadání (409), zbytek je chyba běhu (500).
      const status =
        vysledek.reason === 'MISSING_FIELDS' || vysledek.reason === 'NOT_RADIO_SPOT' ? 409 : 500;
      return NextResponse.json({ error: vysledek.message }, { status });
    }

    return NextResponse.json({ id: vysledek.rodnyListId, version: vysledek.version });
  } catch (err) {
    console.error('POST /api/projects/[id]/rodny-list selhalo:', err);
    const message = err instanceof Error ? err.message : 'Neznámá chyba.';
    return NextResponse.json({ error: `Rodný list se nepodařilo vytvořit (${message}).` }, { status: 500 });
  }
}
