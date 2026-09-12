import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canUseChat } from '@/lib/chatServer';

/**
 * Pořadí připnutých rozhovorů (zadání 12. 9. 2026: „a mělo by jít měnit
 * pořadí těch konverzací přetažením").
 *
 * Pořadí patří ČLOVĚKU, ne rozhovoru — sedí proto na řádku členství, stejně
 * jako připnutí a ztlumení. Přijímá se celý seznam v novém pořadí; kdo v něm
 * není, zůstane bez pořadí a řadí se za ostatní podle poslední zprávy.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({ ids: z.array(z.string().trim().min(1)).max(50) });

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !canUseChat(session.user.role)) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }
  const me = session.user.id;

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Neplatná data.' }, { status: 400 });

  try {
    // Jedna transakce: buď se přerovná všechno, nebo nic. Půlka nového pořadí
    // by vypadala jako další poskakování ikon.
    await prisma.$transaction(
      parsed.data.ids.map((id, index) =>
        prisma.conversationMember.updateMany({
          where: { conversationId: id, userId: me },
          data: { poradiPripnuti: index },
        }),
      ),
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('PUT /api/chat/konverzace/poradi selhalo:', err);
    return NextResponse.json({ error: 'Pořadí se nepodařilo uložit.' }, { status: 500 });
  }
}
