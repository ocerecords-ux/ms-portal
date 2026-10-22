import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canEditProjectMeta } from '@/lib/roles';

/** Úprava a smazání jednoho návrhu herce (22. 10. 2026) - viz ../route.ts. */
export const dynamic = 'force-dynamic';

const schema = z.object({
  userId: z.string().trim().min(1).nullable().optional(),
  jmeno: z.string().trim().max(160).nullable().optional(),
  poznamka: z.string().trim().max(500).nullable().optional(),
  poradi: z.number().int().min(0).max(1000).optional(),
  /** Zelená hvězdička u našeho favorita (22. 10. 2026) - viz níž. */
  preferovany: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; navrhId: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !canEditProjectMeta(session.user.role)) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Neplatná data.' }, { status: 400 });
  const d = parsed.data;

  try {
    /**
     * HVĚZDIČKA JE JEN JEDNA (22. 10. 2026: „hvězdičku zelenou u herce,
     * kterého preferuji"). Když se zapne u jednoho, ostatním v témž projektu
     * zhasne - dvě doporučení najednou by klientovi nic neřekla.
     */
    if (d.preferovany === true) {
      await prisma.navrhHerce.updateMany({
        where: { caflouProjectId: params.id, id: { not: params.navrhId } },
        data: { preferovany: false },
      });
    }

    await prisma.navrhHerce.updateMany({
      // Návrh musí patřit TOMUHLE projektu - jinak by cizí id z adresy
      // přepsalo poznámku u jiné zakázky.
      where: { id: params.navrhId, caflouProjectId: params.id },
      data: {
        ...(d.userId !== undefined ? { userId: d.userId, jmeno: d.userId ? null : undefined } : {}),
        ...(d.jmeno !== undefined ? { jmeno: d.jmeno?.trim() || null } : {}),
        ...(d.poznamka !== undefined ? { poznamka: d.poznamka?.trim() || null } : {}),
        ...(d.poradi !== undefined ? { poradi: d.poradi } : {}),
        ...(d.preferovany !== undefined ? { preferovany: d.preferovany } : {}),
      },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('PATCH navrhy-hercu selhalo:', err);
    return NextResponse.json({ error: 'Uložení se nepodařilo.' }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; navrhId: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !canEditProjectMeta(session.user.role)) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }

  try {
    await prisma.navrhHerce.deleteMany({
      where: { id: params.navrhId, caflouProjectId: params.id },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE navrhy-hercu selhalo:', err);
    return NextResponse.json({ error: 'Smazání se nepodařilo.' }, { status: 500 });
  }
}
