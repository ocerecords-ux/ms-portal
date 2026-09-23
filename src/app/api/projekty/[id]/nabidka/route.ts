import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canEditProjectMeta } from '@/lib/roles';

/**
 * STAV NABÍDKY U REKLAM (zadání 23. 9. 2026). Tři hodnoty, nic víc - viz
 * lib/nabidkaReklamy.tsx.
 *
 * Přehazovat ho smí jen ten, kdo značku vůbec vidí (User.nabidkyReklam) -
 * jinak by ji někdo mohl překlopit, aniž by tušil, co znamená.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  stav: z.enum(['CEKA', 'SCHVALENA', 'NESCHVALENA']),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !canEditProjectMeta(session.user.role)) {
      return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
    }

    const ja = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { nabidkyReklam: true },
    });
    if (!ja?.nabidkyReklam) {
      return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
    }

    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Neplatná data.' }, { status: 400 });
    }

    await prisma.projectMeta.update({
      where: { caflouProjectId: params.id },
      data: { nabidkaStav: parsed.data.stav, nabidkaStavAt: new Date() },
    });

    return NextResponse.json({ ok: true, stav: parsed.data.stav });
  } catch (err) {
    console.error('PATCH /api/projekty/[id]/nabidka selhalo:', err);
    return NextResponse.json({ error: 'Uložení se nezdařilo.' }, { status: 500 });
  }
}
