import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';
import { prepocitejUhradu } from '@/lib/uhradyVydajeServer';
import { odpovedChyby, odpovedChybyS } from '@/lib/chybyApi';

/**
 * Smazání jedné úhrady (25. 9. 2026). Překlep v částce se opravuje tak, že se
 * řádek smaže a napíše znovu — úhrada je záznam o jednom odeslaném převodu,
 * ne pole k přepisování.
 */
export const dynamic = 'force-dynamic';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; uhradaId: string } },
) {
  try {
    const session = await requireAdmin();
    if (!session) return odpovedChyby('chybaApi.bezOpravneni', 403);

    // Kontrola, ze uhrada patri k tomu dokladu - jinak by sla smazat cizi
    // podstrcenim ciziho id.
    const uhrada = await prisma.uhradaVydaje.findUnique({
      where: { id: params.uhradaId },
      select: { id: true, expenseId: true },
    });
    if (!uhrada || uhrada.expenseId !== params.id) {
      return odpovedChyby('chybaApi.uhradaNeexistuje', 404);
    }

    await prisma.uhradaVydaje.delete({ where: { id: params.uhradaId } });
    const stav = await prepocitejUhradu(params.id);
    return NextResponse.json({ ok: true, ...stav });
  } catch (err) {
    console.error('DELETE /api/admin/expenses/[id]/uhrady/[uhradaId] selhalo:', err);
    const message = err instanceof Error ? err.message : 'Neznámá chyba.';
    return odpovedChybyS('chybaApi.smazaniNezdariloS', { zprava: message }, 500);
  }
}
