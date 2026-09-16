import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminGuard';
import { najdiVAresu } from '@/lib/ares';

// Nacteni udaju firmy z ARES podle ICO (zadani 6. 9. 2026: "bylo by dobré,
// kdyby šlo údaje načíst z registru podle IČ").
//
// Samotne dotazovani sedi v lib/ares.ts - ptaji se na nej dve mista, tohle je
// to pro prihlaseneho cloveka v administraci.
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

  const vysledek = await najdiVAresu(req.nextUrl.searchParams.get('ico'));
  if (!vysledek.ok) {
    return NextResponse.json({ error: vysledek.chyba }, { status: vysledek.status });
  }
  return NextResponse.json(vysledek.udaje);
}
