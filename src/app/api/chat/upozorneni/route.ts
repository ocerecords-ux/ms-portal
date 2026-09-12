import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canUseChat } from '@/lib/chatServer';

/**
 * Nastavení upozornění chatu — každý si ho spravuje sám (zadání 12. 9. 2026).
 *
 * Je to nastavení ÚČTU, ne zařízení: kdo si na počítači řekne, že v kanálech
 * projektu chce jen zmínky, má to stejné i na telefonu. Zapnutí samotných
 * upozornění v prohlížeči je věc zařízení a řeší se jinde (/api/push/odber).
 */
export const dynamic = 'force-dynamic';

const rezim = z.enum(['VSE', 'ZMINKY', 'NIC']);
const hodina = z.number().int().min(0).max(23).nullable();

const schema = z.object({
  zpravy: rezim.optional(),
  skupiny: rezim.optional(),
  kanaly: rezim.optional(),
  tichoOd: hodina.optional(),
  tichoDo: hodina.optional(),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !canUseChat(session.user.role)) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }

  const ja = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      chatUpozorneniZpravy: true,
      chatUpozorneniSkupiny: true,
      chatUpozorneniKanaly: true,
      chatTichoOd: true,
      chatTichoDo: true,
    },
  });

  return NextResponse.json({
    zpravy: ja?.chatUpozorneniZpravy ?? 'VSE',
    skupiny: ja?.chatUpozorneniSkupiny ?? 'VSE',
    kanaly: ja?.chatUpozorneniKanaly ?? 'ZMINKY',
    tichoOd: ja?.chatTichoOd ?? null,
    tichoDo: ja?.chatTichoDo ?? null,
  });
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !canUseChat(session.user.role)) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Neplatná data.' }, { status: 400 });

  const { zpravy, skupiny, kanaly, tichoOd, tichoDo } = parsed.data;
  const ulozeno = await prisma.user.update({
    where: { id: session.user.id },
    data: {
      ...(zpravy ? { chatUpozorneniZpravy: zpravy } : {}),
      ...(skupiny ? { chatUpozorneniSkupiny: skupiny } : {}),
      ...(kanaly ? { chatUpozorneniKanaly: kanaly } : {}),
      ...(tichoOd !== undefined ? { chatTichoOd: tichoOd } : {}),
      ...(tichoDo !== undefined ? { chatTichoDo: tichoDo } : {}),
    },
    select: {
      chatUpozorneniZpravy: true,
      chatUpozorneniSkupiny: true,
      chatUpozorneniKanaly: true,
      chatTichoOd: true,
      chatTichoDo: true,
    },
  });

  return NextResponse.json({
    zpravy: ulozeno.chatUpozorneniZpravy,
    skupiny: ulozeno.chatUpozorneniSkupiny,
    kanaly: ulozeno.chatUpozorneniKanaly,
    tichoOd: ulozeno.chatTichoOd,
    tichoDo: ulozeno.chatTichoDo,
  });
}
