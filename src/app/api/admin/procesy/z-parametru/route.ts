import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminGuard';
import { ulozParametryDoProcesu } from '@/lib/procesyZParametru';

/**
 * NAČTENÍ TECHNICKÝCH PARAMETRŮ DO PROCESŮ (zadání 28. 9. 2026: „do těch
 * procesů ulož technické parametry").
 *
 * Spouští se tlačítkem ve Správě procesů, ne samo při každém uložení sady -
 * kdyby to běželo na pozadí, přepsalo by to článek i ve chvíli, kdy ho někdo
 * zrovna čte na poradě, a nikdo by nevěděl proč.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

  try {
    const vysledek = await ulozParametryDoProcesu(session.user.id);
    return NextResponse.json(vysledek);
  } catch (err) {
    console.error('POST /api/admin/procesy/z-parametru selhalo:', err);
    return NextResponse.json({ error: 'Parametry se nepodařilo načíst.' }, { status: 500 });
  }
}
