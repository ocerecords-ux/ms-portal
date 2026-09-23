import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

/**
 * Vlastní upozornění z portálu (zadání 16. 9. 2026: „klienti by měli mít
 * možnost si to pak zapnout v portálu individuálně").
 *
 * MĚNÍ TO VÝHRADNĚ SVŮJ VLASTNÍ ÚČET: id se bere ze session, nikdy z těla
 * požadavku — jinak by si kdokoliv přepnul upozornění komukoliv jinému.
 *
 * Zatím je tu jediný přepínač (dotočený herec na mém projektu). Další
 * upozornění sem přibudou jako další pole, ne jako další routa.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  dostavaDotocenoKlient: z.boolean().optional(),
  /** Ranní přehled od Bruna v 7:00 (23. 9. 2026) - jen pro tým. */
  ranniPrehled: z.boolean().optional(),
});

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'Nejste přihlášen.' }, { status: 401 });

    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Neplatná data.' }, { status: 400 });
    }

    const data: Record<string, unknown> = {};
    if (parsed.data.dostavaDotocenoKlient !== undefined) {
      data.dostavaDotocenoKlient = parsed.data.dostavaDotocenoKlient;
    }
    if (parsed.data.ranniPrehled !== undefined) data.ranniPrehled = parsed.data.ranniPrehled;
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'Neplatná data.' }, { status: 400 });
    }

    await prisma.user.update({ where: { id: session.user.id }, data });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('PATCH /api/me/upozorneni selhalo:', err);
    return NextResponse.json({ error: 'Uložení se nezdařilo.' }, { status: 500 });
  }
}
