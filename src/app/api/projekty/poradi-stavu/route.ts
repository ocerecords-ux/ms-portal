import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { canEditProjectMeta, isInternalRole } from '@/lib/roles';
import { nactiPoradiStavu, ulozPoradiStavu } from '@/lib/poradiStavuServer';

/**
 * POŘADÍ STAVŮ V PŘEHLEDU PROJEKTŮ (zadání 24. 9. 2026).
 *
 * Číst ho může celý tým (řadí se podle něj tabulka), měnit Žůžo-labůžo
 * a produkce - je to společné nastavení, ne osobní.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({ nazvy: z.array(z.string().trim().min(1).max(120)).max(50) });

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !isInternalRole(session.user.role)) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }
  return NextResponse.json({ poradi: await nactiPoradiStavu() });
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !canEditProjectMeta(session.user.role)) {
      return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
    }

    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'Neplatná data.' }, { status: 400 });

    return NextResponse.json({ poradi: await ulozPoradiStavu(parsed.data.nazvy) });
  } catch (err) {
    console.error('PUT /api/projekty/poradi-stavu selhalo:', err);
    return NextResponse.json({ error: 'Uložení se nezdařilo.' }, { status: 500 });
  }
}
