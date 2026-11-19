import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';

import { authOptions } from '@/lib/auth';
import { odpovedChyby } from '@/lib/chybyApi';
import { oStudiu, ulozPodklady } from '@/lib/emaServer';
import { isInternalRole } from '@/lib/roles';

/**
 * STÁLÉ PODKLADY PRO EMU (19. 11. 2026) - kdo jsme, tón komunikace, hotové
 * tituly. Platí pro všechny kampaně; co je jen k jedné akci, patří do briefu
 * té kampaně.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !isInternalRole(session.user.role)) {
    return odpovedChyby('chybaApi.bezOpravneni', 403);
  }
  return NextResponse.json({ text: await oStudiu() });
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !isInternalRole(session.user.role)) {
    return odpovedChyby('chybaApi.bezOpravneni', 403);
  }
  const parsed = z.object({ text: z.string().max(40000) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return odpovedChyby('chybaApi.neplatnaData', 400);
  await ulozPodklady(parsed.data.text);
  return NextResponse.json({ text: await oStudiu() });
}
