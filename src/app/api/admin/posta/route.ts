import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminGuard';
import { nactiStavPosty, zkontrolujPostu } from '@/lib/postaServer';

/**
 * Schránka s doklady (zadání 12. 9. 2026).
 *
 * GET  — stav pro hlavičku Výdajů (kdy se naposled koukalo, kolik čeká).
 * POST — jedno kolo: stáhnout nové přílohy a pár dokladů přečíst.
 *
 * Kontrola se spouští z prohlížeče, ne z plánovače: účetní otevře Výdaje a
 * portál se mrkne do schránky. Plánovanou úlohu se vyplatí přidat, až bude
 * potřeba mít doklady nahrané i bez toho, aby se na ně někdo díval.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  return NextResponse.json(await nactiStavPosty());
}

export async function POST() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

  const vysledek = await zkontrolujPostu();
  return NextResponse.json({ ...vysledek, stav: await nactiStavPosty() });
}
