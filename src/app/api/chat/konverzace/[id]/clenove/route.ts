import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canUseChat } from '@/lib/chatServer';
import { INTERNAL_ROLES, ROBOT_ROLES } from '@/lib/roles';
import { odpovedChyby } from '@/lib/chybyApi';

/**
 * PŘIDAT ČLOVĚKA DO ROZHOVORU JEDNÍM KLEPNUTÍM (zadání 17. 11. 2026: „nelíbí
 * se mi to přidávání lidí do hromadného chatu. Je to moc klikání… na té horní
 * liště u jména přidat ikonu + a tím přidám někoho do konverzace. Ať nemusím
 * znova tvořit skupinu").
 *
 * ZE SOUKROMÉ SE STANE SKUPINA SAMA. Rozhovor ve dvou je `SOUKROMA` a drží
 * klíč dvojice (`parKlic`); jakmile přibude třetí, přestává to být dvojice -
 * překlopí se na `SKUPINA` bez názvu, klíč se uvolní (jinak by další pokus
 * o rozhovor s tím samým člověkem narazil na unikátní index) a rozhovor se
 * dál jmenuje podle lidí v něm. Historie zůstává, nic se nezakládá znovu.
 *
 * DVĚ MOŽNOSTI U HISTORIE (tentýž den: „1. nevidí historii, která byla před
 * přidáním, 2. vidí historii od začátku založení kanálu"):
 *
 *   CELA  - `vidiOdAt` zůstane prázdné, vidí všechno od založení,
 *   ODTED - `vidiOdAt` = teď, starší zprávy mu server vůbec nepošle.
 *
 * Volí to ten, kdo přidává, a je to vědomé rozhodnutí: do skupiny vedení se
 * nový člověk většinou přidává BEZ historie, do pracovního rozhovoru s ní.
 *
 * KDO SMÍ: jen člen toho rozhovoru. Kanál projektu a dotaz klienta se takhle
 * měnit nedají - ty členy nevybírají.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  userId: z.string().trim().min(1),
  historie: z.enum(['CELA', 'ODTED']).default('CELA'),
});

/** Role, které vůbec mají chat - tentýž seznam jako při zakládání rozhovoru. */
const CLENOVE_CHATU = [...INTERNAL_ROLES, ...ROBOT_ROLES];

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !canUseChat(session.user.role)) {
    return odpovedChyby('chybaApi.bezOpravneni', 403);
  }
  const me = session.user.id;

  try {
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Neplatná data.' }, { status: 400 });
    }
    const { userId, historie } = parsed.data;

    const conversation = await prisma.conversation.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        kind: true,
        vsichni: true,
        members: { select: { userId: true } },
      },
    });
    if (!conversation) return odpovedChyby('chybaApi.konverzaceNenalezena', 404);
    if (!conversation.members.some((m) => m.userId === me)) {
      return odpovedChyby('chybaApi.bezOpravneni', 403);
    }
    if (conversation.kind !== 'SOUKROMA' && conversation.kind !== 'SKUPINA') {
      return NextResponse.json(
        { error: 'Do kanálu projektu ani do dotazu klienta se lidi nepřidávají.' },
        { status: 400 },
      );
    }
    // Skupina pro cely tym se neosazuje rucne - kdo je v tymu, je v ni.
    if (conversation.vsichni) {
      return odpovedChyby('chybaApi.skupinaCelyTymClenove', 400);
    }
    if (conversation.members.some((m) => m.userId === userId)) {
      // Uz tam je - neni co delat a neni to chyba.
      return NextResponse.json({ ok: true, uzTamByl: true });
    }

    const novy = await prisma.user.findFirst({
      where: { id: userId, active: true, role: { in: CLENOVE_CHATU } },
      select: { id: true },
    });
    if (!novy) return odpovedChyby('chybaApi.clenTymuNeznamy', 400);

    // Ze dvojice se stava skupina. parKlic se MUSI uvolnit - jinak by dvojici,
    // ktera uz zadny rozhovor ve dvou nema, blokoval unikatni index.
    if (conversation.kind === 'SOUKROMA') {
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { kind: 'SKUPINA', parKlic: null },
      });
    }

    await prisma.conversationMember.create({
      data: {
        conversationId: conversation.id,
        userId: novy.id,
        // Prazdno = vidi vsechno od zalozeni.
        vidiOdAt: historie === 'ODTED' ? new Date() : null,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('POST /api/chat/konverzace/[id]/clenove selhalo:', err);
    return odpovedChyby('chybaApi.ulozeniNezdarilo', 500);
  }
}
