import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { jePlatnaReakce } from '@/lib/chat';
import { canUseChat, shrnReakce } from '@/lib/chatServer';

/**
 * Reakce smajlikem na konkretni zpravu (zadani 9. 9. 2026).
 *
 * Jediny endpoint, ktery reakci PREPINA: kdyz uz ji uzivatel dal, druhe
 * kliknuti ji odebere - stejne jako u Slacku. Vraci se cely secteny prehled
 * reakci te zpravy, aby si ho panel jen prepsal a nemusel znovu tahat zpravy.
 *
 * Kontroluje se dvoje: ze uzivatel do konverzace vubec smi (stejne pravidlo
 * jako u ctení zprav - kanal k projektu je pro cely tym, soukroma a skupinova
 * jen pro cleny) a ze poslany kod je z nabidky. Kod chodi z prohlizece, takze
 * bez te druhe kontroly by si do databaze mohl kdokoliv ulozit cokoliv.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  code: z.string().trim().min(1).max(40),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !canUseChat(session.user.role)) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }
  const me = session.user.id;

  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success || !jePlatnaReakce(parsed.data.code)) {
      return NextResponse.json({ error: 'Neznámý smajlík.' }, { status: 400 });
    }
    const code = parsed.data.code;

    const message = await prisma.message.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        conversation: { select: { kind: true, members: { select: { userId: true } } } },
      },
    });
    if (!message) return NextResponse.json({ error: 'Zpráva nenalezena.' }, { status: 404 });
    if (
      message.conversation.kind !== 'PROJEKT' &&
      !message.conversation.members.some((m) => m.userId === me)
    ) {
      // Zamerne 404, ne 403 - ať se z odpovědi nedá vyčíst, že zpráva existuje.
      return NextResponse.json({ error: 'Zpráva nenalezena.' }, { status: 404 });
    }

    const klic = { messageId_userId_code: { messageId: message.id, userId: me, code } };
    const stavajici = await prisma.messageReaction.findUnique({ where: klic });
    if (stavajici) {
      await prisma.messageReaction.delete({ where: klic });
    } else {
      await prisma.messageReaction.create({ data: { messageId: message.id, userId: me, code } });
    }

    const rows = await prisma.messageReaction.findMany({
      where: { messageId: message.id },
      orderBy: { createdAt: 'asc' },
      select: {
        code: true,
        userId: true,
        createdAt: true,
        user: { select: { name: true, email: true } },
      },
    });

    return NextResponse.json({ reactions: shrnReakce(rows, me) });
  } catch (err) {
    console.error('POST /api/chat/zpravy/[id]/reakce selhalo:', err);
    return NextResponse.json({ error: 'Reakci se nepodařilo uložit.' }, { status: 500 });
  }
}
