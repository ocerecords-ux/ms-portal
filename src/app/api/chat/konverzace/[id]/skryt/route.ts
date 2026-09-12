import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canUseChat } from '@/lib/chatServer';

/**
 * Uklizení rozhovoru ze seznamu (zadání 12. 9. 2026: „ty konverzace bych mazal
 * třeba přejetím doleva").
 *
 * ZPRÁVY SE NEMAŽOU. Zmizí jen z mého seznamu — druhá strana má svoji
 * konverzaci dál a historie zůstává. Smazat cizí zprávy jedním přejetím prstu
 * by bylo příliš snadné na to, kolik by to napáchalo.
 *
 * A vrátí se, jakmile v něm někdo napíše. Proto se ukládá i čas uklizení:
 * přijít o zprávu kvůli jednomu gestu by bylo horší než mít v seznamu řádek
 * navíc. Skupinu, ze které chce člověk opravdu pryč, opouští DELETE na
 * /api/chat/konverzace/[id].
 */
export const dynamic = 'force-dynamic';

const schema = z.object({ skryto: z.boolean() });

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

  const skrytoAt = parsed.data.skryto ? new Date() : null;
  await prisma.conversationMember.upsert({
    where: { conversationId_userId: { conversationId: params.id, userId: session.user.id } },
    update: { skryto: parsed.data.skryto, skrytoAt },
    create: { conversationId: params.id, userId: session.user.id, skryto: parsed.data.skryto, skrytoAt },
  });

  return NextResponse.json({ skryto: parsed.data.skryto });
}
