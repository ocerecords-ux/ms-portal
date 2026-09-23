import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canEditProjectMeta } from '@/lib/roles';

/**
 * NORMOSTRANY JEDNOHO HERCE NA PROJEKTU (zadání 23. 9. 2026: „v případě, že
 * bude více jak jeden herec u projektu, tak bych potřeboval mít u nich
 * možnost přidat ke každému počet normostran, kvůli plánování").
 *
 * Ukládá se hned při vyplnění, zvlášť od zbytku formuláře projektu - je to
 * číslo pro plánování frekvencí, ne rozepsaná změna, kterou by měl někdo
 * potvrzovat spolu se stavem a termíny.
 *
 * Prázdné pole záznam smaže; nula by v plánování vypadala jako „nic netočí".
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  userId: z.string().trim().min(1),
  pageCount: z.number().int().min(0).max(100000).nullable(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !canEditProjectMeta(session.user.role)) {
      return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
    }

    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Neplatná data.' }, { status: 400 });
    }
    const { userId, pageCount } = parsed.data;
    const caflouProjectId = params.id;

    if (pageCount === null || pageCount === 0) {
      await prisma.herecNormostrany.deleteMany({ where: { caflouProjectId, userId } });
      return NextResponse.json({ ok: true, pageCount: null });
    }

    const zaznam = await prisma.herecNormostrany.upsert({
      where: { caflouProjectId_userId: { caflouProjectId, userId } },
      create: { caflouProjectId, userId, pageCount },
      update: { pageCount },
    });
    return NextResponse.json({ ok: true, pageCount: zaznam.pageCount });
  } catch (err) {
    console.error('PATCH /api/projekty/[id]/herci-normostrany selhalo:', err);
    return NextResponse.json({ error: 'Uložení se nezdařilo.' }, { status: 500 });
  }
}
