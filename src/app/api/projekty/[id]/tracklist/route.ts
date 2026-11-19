import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { isInternalRole } from '@/lib/roles';
import { klientSmiTracklist, nactiTracklist, ulozTracklist } from '@/lib/tracklistServer';

/**
 * TRACKLIST AUDIOKNIHY (zadání 15. 10. 2026).
 *
 * GET  seznam stop
 * PUT  uloží celý seznam najednou (viz model TrackProjektu)
 *
 * Odnikud se nic nenačítá (upřesnění 15. 10. 2026: „nechci nikde načítat
 * tracklist") - tracklist je předpis, podle kterého se stopy teprve
 * pojmenují, ne soupis toho, co na Disku leží.
 *
 * KROMĚ NÁS SMÍ I KLIENT, KTERÝ TRACKLISTY DODÁVÁ (zadání 19. 11. 2026:
 * „a pak by se k němu měli dostat i v portálu"). Rozhoduje příznak u firmy
 * a to, že zakázka té firmě patří - viz lib/tracklistServer.ts. Je to pořád
 * jeden a týž seznam, ne klientská kopie: co napíše klient, vidíme my.
 */
export const dynamic = 'force-dynamic';

async function kdoSmi(caflouProjectId: string): Promise<boolean> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return false;
  if (isInternalRole(session.user.role)) return true;
  return klientSmiTracklist(caflouProjectId, session.user.companyId ?? null);
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await kdoSmi(params.id))) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }

  return NextResponse.json({ tracky: await nactiTracklist(params.id) });
}

const schema = z.object({
  tracky: z
    .array(
      z.object({
        nazevTracku: z.string().trim().max(300),
        nazevKapitoly: z.string().trim().max(300),
      }),
    )
    .max(500),
});

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await kdoSmi(params.id))) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Neplatná data.' }, { status: 400 });
  }

  try {
    /**
     * Tvar názvu stopy i mazání prázdných řádků řeší `ulozTracklist` - je to
     * pravidlo předpisu, ne vlastnost jednoho formuláře, a platí stejně
     * i pro seznam, který uloží klient ze svého odkazu.
     */
    return NextResponse.json({ tracky: await ulozTracklist(params.id, parsed.data.tracky) });
  } catch (err) {
    console.error('Tracklist: ulozeni selhalo:', err);
    return NextResponse.json({ error: 'Uložení se nepodařilo.' }, { status: 500 });
  }
}
