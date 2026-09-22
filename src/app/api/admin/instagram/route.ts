import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminGuard';
import { prisma } from '@/lib/db';
import { odpojUcet } from '@/lib/instagramServer';

/**
 * Instagram na tabulích (22. 9. 2026).
 * DELETE - odpojit účet. PATCH { studioId, zapnuto } - okno u studia zapnout/vypnout.
 */
export async function DELETE() {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  await odpojUcet();
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  const telo = (await req.json().catch(() => ({}))) as { studioId?: string; zapnuto?: boolean };
  if (!telo.studioId || typeof telo.zapnuto !== 'boolean') {
    return NextResponse.json({ error: 'Neplatná data.' }, { status: 400 });
  }
  await prisma.studio.update({ where: { id: telo.studioId }, data: { tabuleInstagram: telo.zapnuto } });
  return NextResponse.json({ ok: true });
}
