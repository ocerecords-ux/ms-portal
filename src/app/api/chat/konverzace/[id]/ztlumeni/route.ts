import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canUseChat } from '@/lib/chatServer';

/**
 * Ztlumení jednoho rozhovoru (zadání 12. 9. 2026).
 *
 * Nejčastěji používané nastavení ze všech: jeden ukecaný kanál se umlčí
 * a zbytek zůstane, jak byl. Zprávy chodí dál a počítají se jako nepřečtené —
 * jen z nich nechodí upozornění.
 *
 * Řádek členství u kanálu projektu vzniká, až když tam člověk poprvé zajde;
 * kdyby ještě nebyl, ztlumení ho založí.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({ ztlumeno: z.boolean() });

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
    update: { ztlumeno: parsed.data.ztlumeno },
    create: { conversationId: params.id, userId: session.user.id, ztlumeno: parsed.data.ztlumeno },
  });

  return NextResponse.json({ ztlumeno: parsed.data.ztlumeno });
}
