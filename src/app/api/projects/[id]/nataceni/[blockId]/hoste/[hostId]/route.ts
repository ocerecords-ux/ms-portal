import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { canManageCalendar } from '@/lib/roles';
import { nactiNataceni, smazHosta, upravHosta } from '@/lib/hosteNataceniServer';

/** Úprava a smazání jednoho hosta (zadání 30. 9. 2026). */
export const dynamic = 'force-dynamic';

const schema = z.object({
  jmeno: z.string().trim().max(200).nullable().optional(),
  online: z.boolean().optional(),
});

/**
 * Host musí patřit natáčení z adresy a to projektu z adresy - jinak by se
 * přes cizí id dalo sáhnout na hosty jiné zakázky.
 */
async function over(blockId: string, hostId: string, caflouProjectId: string) {
  const nalezeno = await nactiNataceni(blockId);
  if (!nalezeno || nalezeno.caflouProjectId !== caflouProjectId) return null;
  if (!nalezeno.data.hoste.some((h) => h.id === hostId)) return null;
  return nalezeno;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; blockId: string; hostId: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Nepřihlášeno.' }, { status: 401 });
  if (!canManageCalendar(session.user.role)) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }

  const { id, blockId, hostId } = await params;
  if (!(await over(blockId, hostId, id))) {
    return NextResponse.json({ error: 'Host nenalezen.' }, { status: 404 });
  }

  const telo = await req.json().catch(() => null);
  const data = schema.safeParse(telo);
  if (!data.success) return NextResponse.json({ error: 'Neplatná data.' }, { status: 400 });

  if (!(await upravHosta(hostId, data.data))) {
    return NextResponse.json({ error: 'Hosta se nepodařilo uložit.' }, { status: 500 });
  }

  const nove = await nactiNataceni(blockId);
  return NextResponse.json({ nataceni: nove?.data ?? null });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; blockId: string; hostId: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Nepřihlášeno.' }, { status: 401 });
  if (!canManageCalendar(session.user.role)) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }

  const { id, blockId, hostId } = await params;
  if (!(await over(blockId, hostId, id))) {
    return NextResponse.json({ error: 'Host nenalezen.' }, { status: 404 });
  }

  if (!(await smazHosta(hostId))) {
    return NextResponse.json({ error: 'Hosta se nepodařilo smazat.' }, { status: 500 });
  }

  const nove = await nactiNataceni(blockId);
  return NextResponse.json({ nataceni: nove?.data ?? null });
}
