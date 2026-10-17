import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { isInternalRole } from '@/lib/roles';
import { posliVyzvu, stavVyzvy } from '@/lib/vyzvaHudbaServer';

/**
 * POSLAT KLIENTOVI VÝZVU K HUDBĚ HNED (17. 10. 2026).
 *
 * Výzva odchází sama tři dny před první frekvencí; tohle je tlačítko pro
 * případ, že se to ví dřív - nebo když je potřeba ji poslat ještě jednou.
 */
export const dynamic = 'force-dynamic';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isInternalRole(session.user.role)) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }

  const { id } = await params;
  const vysledek = await posliVyzvu(id, true);
  if (!vysledek.ok) return NextResponse.json({ error: vysledek.duvod }, { status: 502 });

  return NextResponse.json({ vyzva: await stavVyzvy(id) });
}
