import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canUseChat } from '@/lib/chatServer';

/**
 * Upozornění pro JEDEN rozhovor (zadání 12. 9. 2026: „potřeboval bych ještě
 * upravovat notifikace zvlášť na soukromé zprávy a na individuální skupiny").
 *
 * Ztlumení bylo jen vypínač; tohle je celá trojice Vše / Jen zmínky / Nic —
 * u ukecané skupiny totiž člověk většinou nechce ticho, chce vědět, když se
 * řeší on. Prázdná hodnota znamená „řiď se obecným nastavením".
 *
 * DRŽÍ SE SE ZTLUMENÍM V SOULADU: Nic = ztlumeno, cokoliv jiného = neztlumeno.
 * Dvě nastavení, která si můžou protiřečit, jsou horší než jedno.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({ upozorneni: z.enum(['VSE', 'ZMINKY', 'NIC']).nullable() });

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !canUseChat(session.user.role)) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Neplatná data.' }, { status: 400 });
  const { upozorneni } = parsed.data;

  const konverzace = await prisma.conversation.findUnique({
    where: { id: params.id },
    select: { id: true },
  });
  if (!konverzace) return NextResponse.json({ error: 'Konverzace nenalezena.' }, { status: 404 });

  const ztlumeno = upozorneni === 'NIC';
  await prisma.conversationMember.upsert({
    where: { conversationId_userId: { conversationId: params.id, userId: session.user.id } },
    update: { upozorneni, ztlumeno },
    create: { conversationId: params.id, userId: session.user.id, upozorneni, ztlumeno },
  });

  return NextResponse.json({ upozorneni, ztlumeno });
}
