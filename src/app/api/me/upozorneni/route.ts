import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { isInternalRole } from '@/lib/roles';

/**
 * Vlastní upozornění z portálu (zadání 16. 9. 2026: „klienti by měli mít
 * možnost si to pak zapnout v portálu individuálně").
 *
 * MĚNÍ TO VÝHRADNĚ SVŮJ VLASTNÍ ÚČET: id se bere ze session, nikdy z těla
 * požadavku — jinak by si kdokoliv přepnul upozornění komukoliv jinému.
 *
 * Klient si tu přepíná dotočeného herce a změnu natáčecího termínu, tým ranní
 * přehled od Bruna, výběr termínů hercem a dotočení. Další upozornění sem
 * přibudou jako další pole, ne jako další routa.
 *
 * TÝMOVÁ POLE JSOU JEN PRO TÝM: nesou VŠECHNY projekty, ne jen ty, které ten
 * člověk v portálu vidí. Klient, který by si je poslal rovnou na tuhle routu,
 * by se jimi dozvěděl o cizích zakázkách - proto se u nich hlídá role.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  dostavaDotocenoKlient: z.boolean().optional(),
  /** Změna natáčecího termínu na mém projektu (1. 10. 2026). */
  dostavaZmenuTerminuKlient: z.boolean().optional(),
  /** Ranní přehled od Bruna v 7:00 (23. 9. 2026) - jen pro tým. */
  ranniPrehled: z.boolean().optional(),
  /** Herec si naklikal termíny (5. 10. 2026) - jen pro tým. */
  dostavaVyberTerminu: z.boolean().optional(),
  /** Dotočeno s hercem (11. 9. 2026) - jen pro tým. */
  dostavaDotoceno: z.boolean().optional(),
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
    if (parsed.data.dostavaZmenuTerminuKlient !== undefined) {
      data.dostavaZmenuTerminuKlient = parsed.data.dostavaZmenuTerminuKlient;
    }
    if (parsed.data.ranniPrehled !== undefined) data.ranniPrehled = parsed.data.ranniPrehled;

    const tymova = parsed.data.dostavaVyberTerminu !== undefined || parsed.data.dostavaDotoceno !== undefined;
    if (tymova && !isInternalRole(session.user.role)) {
      return NextResponse.json({ error: 'Tohle upozornění vám nepatří.' }, { status: 403 });
    }
    if (parsed.data.dostavaVyberTerminu !== undefined) {
      data.dostavaVyberTerminu = parsed.data.dostavaVyberTerminu;
    }
    if (parsed.data.dostavaDotoceno !== undefined) data.dostavaDotoceno = parsed.data.dostavaDotoceno;

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
