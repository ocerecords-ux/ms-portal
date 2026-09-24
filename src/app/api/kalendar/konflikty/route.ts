import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { najdiKonflikty } from '@/lib/konfliktyServer';

/**
 * KONFLIKTY V KALENDÁŘI (zadání 23. 9. 2026) - pro zobrazený rozsah.
 *
 * `moje` vrací jen tomu, komu patří (počítají se z jeho událostí), `provoz`
 * každému, kdo smí na kalendář - viz lib/konfliktyServer.ts.
 */
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Nejste přihlášen.' }, { status: 401 });

  const url = new URL(req.url);
  const odText = url.searchParams.get('od');
  const doText = url.searchParams.get('do');
  const od = odText ? new Date(odText) : new Date();
  const doKdy = doText ? new Date(doText) : new Date(od.getTime() + 30 * 24 * 3600_000);

  if (Number.isNaN(od.getTime()) || Number.isNaN(doKdy.getTime()) || doKdy <= od) {
    return NextResponse.json({ error: 'Neplatný rozsah.' }, { status: 400 });
  }

  try {
    const konflikty = await najdiKonflikty(session.user.id, session.user.role, od, doKdy);
    return NextResponse.json(konflikty);
  } catch (err) {
    console.error('GET /api/kalendar/konflikty selhalo:', err);
    return NextResponse.json({ moje: [], provoz: [], skryte: [] });
  }
}
