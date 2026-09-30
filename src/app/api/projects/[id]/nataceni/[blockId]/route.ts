import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { canManageCalendar } from '@/lib/roles';
import { nactiNataceni, nastavHovorOdkaz } from '@/lib/hosteNataceniServer';

/**
 * ODKAZ NA HOVOR U JEDNOHO NATÁČENÍ (zadání 30. 9. 2026).
 *
 * Prázdný řetězec = smazat, a tím zase platí odkaz studia. Proto se posílá
 * celé pole, ne „jen když je vyplněné" - jinak by se zapsaný odkaz nedal
 * odebrat.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  hovorOdkaz: z.string().trim().max(500).nullable(),
});

/**
 * Natáčení musí patřit projektu z adresy - id z těla se nevěří.
 *
 * NEEXPORTUJE SE: v souboru routy smí být jen obsluhy a nastavení, cokoliv
 * dalšího Next při buildu odmítne.
 */
async function overNataceni(blockId: string, caflouProjectId: string) {
  const nalezeno = await nactiNataceni(blockId);
  if (!nalezeno || nalezeno.caflouProjectId !== caflouProjectId) return null;
  return nalezeno;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; blockId: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Nepřihlášeno.' }, { status: 401 });
  if (!canManageCalendar(session.user.role)) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }

  const { id, blockId } = await params;
  if (!(await overNataceni(blockId, id))) {
    return NextResponse.json({ error: 'Natáčení nenalezeno.' }, { status: 404 });
  }

  const telo = await req.json().catch(() => null);
  const data = schema.safeParse(telo);
  if (!data.success) return NextResponse.json({ error: 'Neplatná data.' }, { status: 400 });

  if (!(await nastavHovorOdkaz(blockId, data.data.hovorOdkaz))) {
    return NextResponse.json({ error: 'Odkaz se nepodařilo uložit.' }, { status: 500 });
  }

  const nove = await nactiNataceni(blockId);
  return NextResponse.json({ nataceni: nove?.data ?? null });
}
