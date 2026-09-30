import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { canManageCalendar } from '@/lib/roles';
import { rozeberAdresy } from '@/lib/hosteNataceni';
import { nactiNataceni, pridejHosty } from '@/lib/hosteNataceniServer';

/**
 * PŘIDÁNÍ HOSTŮ K NATÁČENÍ (zadání 30. 9. 2026: „potřebuju tam naházet
 * i více lidí").
 *
 * Posílá se JEDEN TEXT, ne seznam: produkce zkopíruje adresy z mailu nebo
 * z tabulky a vloží je najednou. Rozebrání je v lib/hosteNataceni.ts, ať
 * formulář může ukázat stejný výsledek ještě před odesláním.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  adresy: z.string().min(1).max(5000),
  online: z.boolean().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; blockId: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Nepřihlášeno.' }, { status: 401 });
  if (!canManageCalendar(session.user.role)) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }

  const { id, blockId } = await params;
  const nalezeno = await nactiNataceni(blockId);
  if (!nalezeno || nalezeno.caflouProjectId !== id) {
    return NextResponse.json({ error: 'Natáčení nenalezeno.' }, { status: 404 });
  }

  const telo = await req.json().catch(() => null);
  const data = schema.safeParse(telo);
  if (!data.success) return NextResponse.json({ error: 'Neplatná data.' }, { status: 400 });

  const { hoste, spatne } = rozeberAdresy(data.data.adresy);
  if (hoste.length === 0) {
    return NextResponse.json(
      { error: 'Žádná z adres nevypadá jako e-mail.', spatne },
      { status: 400 },
    );
  }

  const pridano = await pridejHosty(
    blockId,
    hoste,
    data.data.online ?? false,
    session.user.id ?? null,
  );

  const nove = await nactiNataceni(blockId);
  return NextResponse.json({ pridano, spatne, nataceni: nove?.data ?? null });
}
