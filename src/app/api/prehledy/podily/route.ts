import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

/**
 * PODÍL NA OBRATU Z PŘEHLEDU BONUSŮ (zadání 6. 10. 2026: „a ještě bych měl mít
 * já možnost upravit ta procenta").
 *
 * Měnit se dá i na kartě uživatele, ale rozdělovat podíly se v praxi dělá nad
 * tím přehledem, kde je vidět, co komu vychází - a tam se taky hned ukáže,
 * co s tím změna udělala.
 *
 * JEN ŽŮŽO-LABŮŽO: jsou to peníze lidí a podíl si nikdo nemá nastavovat sám.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  userId: z.string().trim().min(1),
  /** Procenta; null nebo 0 znamená žádný podíl a záložka se tomu člověku schová. */
  procento: z.number().min(0).max(100).nullable(),
});

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
    }

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Neplatná data.' }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: parsed.data.userId },
      data: { podilNaObratu: parsed.data.procento && parsed.data.procento > 0 ? parsed.data.procento : null },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('PATCH /api/prehledy/podily selhalo:', err);
    return NextResponse.json({ error: 'Uložení se nezdařilo.' }, { status: 500 });
  }
}
