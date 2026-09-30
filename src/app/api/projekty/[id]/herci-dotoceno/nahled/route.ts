import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { canEditProjectMeta } from '@/lib/roles';
import { nahledDotoceni } from '@/lib/dotoceniServer';

/**
 * CO SE STANE, KDYŽ SE HERCI OZNAČÍ DOTOČENO (zadání 30. 9. 2026: „dal bych
 * tam pojistku, aby když kliknu na dotočeno s hercem, aby se to ještě zeptalo
 * a ukázalo, co se stane — na koho jde notifikace").
 *
 * Jen čte a počítá; nic se tím nemění. Práva jsou stejná jako u samotného
 * označení - kdo fajfku kliknout nesmí, nemá se z náhledu dozvědět, komu
 * u toho projektu co chodí.
 */
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Nepřihlášeno.' }, { status: 401 });
  if (!canEditProjectMeta(session.user.role)) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }

  const userId = req.nextUrl.searchParams.get('userId')?.trim();
  if (!userId) return NextResponse.json({ error: 'Chybí herec.' }, { status: 400 });

  const nahled = await nahledDotoceni(params.id, userId);
  if (!nahled) return NextResponse.json({ error: 'Projekt nebo herec nenalezen.' }, { status: 404 });

  return NextResponse.json(nahled);
}
