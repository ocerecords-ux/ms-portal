import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { MAX_MESSAGE_LENGTH } from '@/lib/chat';
import { canUseChat, userLabel } from '@/lib/chatServer';

// Zpravy jedne konverzace (zadani 8. 9. 2026). Otevreni konverzace zaroven
// znamena "precteno" - proto se pri GET posouva lastReadAt.
export const dynamic = 'force-dynamic';

const schema = z.object({
  body: z
    .string()
    .trim()
    .min(1, 'Zpráva je prázdná.')
    .max(MAX_MESSAGE_LENGTH, 'Zpráva je moc dlouhá.'),
  /** Odpoved ve vlakne - ID zpravy, pod kterou ma viset. */
  parentId: z.string().trim().min(1).optional(),
});

/**
 * Smi tenhle uzivatel do teto konverzace? Kanal k projektu je pro cely tym,
 * soukroma a skupinova jen pro cleny - kontroluje se pri kazdem pozadavku,
 * nikdy se nespolehame na to, co posle prohlizec.
 */
async function nactiPristupnou(conversationId: string, userId: string) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      members: {
        select: {
          userId: true,
          lastReadAt: true,
          user: { select: { name: true, email: true } },
        },
      },
    },
  });
  if (!conversation) return null;
  if (conversation.kind !== 'PROJEKT' && !conversation.members.some((m) => m.userId === userId)) {
    return null;
  }
  return conversation;
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !canUseChat(session.user.role)) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }
  const me = session.user.id;

  try {
    const conversation = await nactiPristupnou(params.id, me);
    if (!conversation) return NextResponse.json({ error: 'Konverzace nenalezena.' }, { status: 404 });

    // ?vlakno=<id> vrati zpravu a odpovedi pod ni; jinak hlavni proud, tedy
    // jen zpravy bez rodice (zadani 8. 9. 2026: odpovedi ve vlakne).
    const vlakno = req.nextUrl.searchParams.get('vlakno');
    const zpravy = await prisma.message.findMany({
      where: vlakno
        ? { conversationId: conversation.id, OR: [{ id: vlakno }, { parentId: vlakno }] }
        : { conversationId: conversation.id, parentId: null },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        user: { select: { id: true, name: true, email: true, photoUrl: true } },
        _count: { select: { replies: true } },
      },
    });

    // Otevrel jsem si ji, takze je precteno. U kanalu k projektu tim zaroven
    // vznikne radek clenstvi, ktery drzi stav precteni.
    await prisma.conversationMember.upsert({
      where: { conversationId_userId: { conversationId: conversation.id, userId: me } },
      update: { lastReadAt: new Date() },
      create: { conversationId: conversation.id, userId: me },
    });

    // "Zobrazeno": kdo mel konverzaci otevrenou uz potom, co zprava prisla.
    // Bere se z lastReadAt clena - stejneho udaje, ze ktereho se pocitaji
    // neprectene, takze nic dalsiho se nikam neuklada.
    const ostatniClenove = conversation.members.filter((m) => m.userId !== me);

    return NextResponse.json({
      zpravy: zpravy.reverse().map((m) => ({
        id: m.id,
        body: m.body,
        createdAt: m.createdAt.toISOString(),
        authorId: m.userId,
        authorLabel: userLabel(m.user),
        authorPhotoUrl: m.user.photoUrl,
        mine: m.userId === me,
        replyCount: m._count.replies,
        seenBy: ostatniClenove
          .filter((clen) => clen.lastReadAt >= m.createdAt)
          .map((clen) => userLabel(clen.user)),
      })),
    });
  } catch (err) {
    console.error('GET /api/chat/konverzace/[id]/zpravy selhalo:', err);
    return NextResponse.json({ error: 'Zprávy se nepodařilo načíst.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !canUseChat(session.user.role)) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }
  const me = session.user.id;

  try {
    const conversation = await nactiPristupnou(params.id, me);
    if (!conversation) return NextResponse.json({ error: 'Konverzace nenalezena.' }, { status: 404 });

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Neplatná data.' }, { status: 400 });
    }

    // Odpovidat jde jen na zpravu z teze konverzace, a nikdy na odpoved -
    // vlakna zustavaji jednourovnova, stejne jako u Slacku.
    let parentId: string | null = null;
    if (parsed.data.parentId) {
      const parent = await prisma.message.findFirst({
        where: { id: parsed.data.parentId, conversationId: conversation.id, parentId: null },
        select: { id: true },
      });
      if (!parent) return NextResponse.json({ error: 'Vlákno se nenašlo.' }, { status: 400 });
      parentId = parent.id;
    }

    const message = await prisma.message.create({
      data: { conversationId: conversation.id, userId: me, body: parsed.data.body, parentId },
      include: { user: { select: { id: true, name: true, email: true, photoUrl: true } } },
    });

    await prisma.$transaction([
      prisma.conversation.update({
        where: { id: conversation.id },
        data: { lastMessageAt: message.createdAt },
      }),
      prisma.conversationMember.upsert({
        where: { conversationId_userId: { conversationId: conversation.id, userId: me } },
        update: { lastReadAt: message.createdAt },
        create: { conversationId: conversation.id, userId: me, lastReadAt: message.createdAt },
      }),
    ]);

    return NextResponse.json(
      {
        id: message.id,
        body: message.body,
        createdAt: message.createdAt.toISOString(),
        authorId: message.userId,
        authorLabel: userLabel(message.user),
        authorPhotoUrl: message.user.photoUrl,
        mine: true,
        replyCount: 0,
        // Prave odeslanou zpravu jeste nikdo videt nemohl.
        seenBy: [],
      },
      { status: 201 },
    );
  } catch (err) {
    console.error('POST /api/chat/konverzace/[id]/zpravy selhalo:', err);
    return NextResponse.json({ error: 'Zprávu se nepodařilo odeslat.' }, { status: 500 });
  }
}
