import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isInternalRole } from '@/lib/roles';
import { obnovOdkaz, stavOdkazu, zajistiOdkaz, zavriOdkaz } from '@/lib/preposlechOdkaz';

/**
 * Správa klientského odkazu na přeposlech (zadání 11. 9. 2026).
 *
 * Jen pro tým Mediaspace: klient tenhle konec vůbec nevidí, on dostane
 * hotovou adresu v mailu. `POST` odkaz vyrobí (nebo vrátí ten stávající),
 * `POST ?novy=1` ho vymění za nový a ten předchozí tím zneplatní,
 * `DELETE` ho zavře bez náhrady.
 */
export const dynamic = 'force-dynamic';

async function overTym() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { chyba: NextResponse.json({ error: 'Nepřihlášeno.' }, { status: 401 }) };
  if (!isInternalRole(session.user.role)) {
    return { chyba: NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 }) };
  }
  return { jmeno: session.user.name || session.user.email || null };
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const pristup = await overTym();
  if ('chyba' in pristup) return pristup.chyba;
  return NextResponse.json(await stavOdkazu(params.id));
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const pristup = await overTym();
  if ('chyba' in pristup) return pristup.chyba;

  const novy = req.nextUrl.searchParams.get('novy') === '1';
  const token = novy
    ? await obnovOdkaz(params.id, pristup.jmeno)
    : await zajistiOdkaz(params.id, pristup.jmeno);
  if (!token) return NextResponse.json({ error: 'Odkaz se nepodařilo vyrobit.' }, { status: 500 });

  return NextResponse.json(await stavOdkazu(params.id));
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const pristup = await overTym();
  if ('chyba' in pristup) return pristup.chyba;
  await zavriOdkaz(params.id);
  return NextResponse.json(await stavOdkazu(params.id));
}
