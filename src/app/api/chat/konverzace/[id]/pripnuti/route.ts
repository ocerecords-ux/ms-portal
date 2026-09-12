import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canUseChat } from '@/lib/chatServer';

/**
 * Připnutí rozhovoru nahoru jako rychlá volba (zadání 12. 9. 2026: „bylo by
 * dobré mít možnost si připnout někam nahoru v tom chatu skupiny a uživatele,
 * jako rychlé volby").
 *
 * Připnutí patří ČLOVĚKU, ne rozhovoru: každý si nahoru dá to svoje. Sedí
 * proto na řádku členství, stejně jako ztlumení.
 *
 * Řádek členství u kanálu projektu vzniká, až když tam člověk poprvé zajde;
 * kdyby ještě nebyl, připnutí ho založí.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({ pripnuto: z.boolean() });

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !canUseChat(session.user.role)) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Neplatná data.' }, { status: 400 });

  const konverzace = await prisma.conversation.findUnique({
    where: { id: params.id },
    select: { id: true },
  });
  if (!konverzace) return NextResponse.json({ error: 'Konverzace nenalezena.' }, { status: 404 });

  await prisma.conversationMember.upsert({
    where: { conversationId_userId: { conversationId: params.id, userId: session.user.id } },
    update: { pripnuto: parsed.data.pripnuto },
    create: { conversationId: params.id, userId: session.user.id, pripnuto: parsed.data.pripnuto },
  });

  return NextResponse.json({ pripnuto: parsed.data.pripnuto });
}
