import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminGuard';
import { prehledProjektu, prenesProjektyZCaflou } from '@/lib/prenosProjektu';

/**
 * Přenos projektů z Caflou do portálu (zadání 10. 9. 2026).
 *
 * GET vrátí přehled, co portál drží - dá se pustit kdykoliv a nic nemění.
 * POST spustí samotný přenos. Jen pro Žůžo-labůžo; jde o jednorázový krok
 * před odpojením Caflou, ne o něco, co se běžně mačká.
 */
export const dynamic = 'force-dynamic';
// Sedm stovek projektů po stovkách - výchozích deset vteřin nestačí.
export const maxDuration = 300;

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  return NextResponse.json(await prehledProjektu());
}

export async function POST() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

  const vysledek = await prenesProjektyZCaflou();
  return NextResponse.json({ ...vysledek, prehled: await prehledProjektu() });
}
