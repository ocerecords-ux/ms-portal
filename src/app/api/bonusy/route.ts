import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { durationMinutes } from '@/lib/timesheets';

/**
 * RUČNĚ PŘIDANÝ BONUS (zadání 15. 9. 2026: „potřebuju, aby Petr mohl mít
 * možnost přidat bonus ručně").
 *
 * Portál navrhuje jen to, co spočítá z výkazů — jenže důvodů k bonusu je víc
 * než jeden: kniha navíc, zachráněný termín, práce, která se do výkazů
 * nevešla. Tohle je cesta, jak takový bonus zapsat.
 *
 * Ručně přidaný bonus je rovnou SCHVÁLENÝ — přidává ho ten, kdo bonusy
 * schvaluje, a dvojklik na totéž nic nepřidá. Jediná výjimka je bonus sám
 * sobě: ten zůstane jako návrh, aby ho odklikl kolega.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  caflouProjectId: z.string().trim().min(1, 'Vyberte projekt.'),
  userId: z.string().trim().min(1, 'Vyberte zvukaře.'),
  castka: z.number().int().min(1, 'Částka musí být větší než nula.').max(1_000_000),
  poznamka: z.string().trim().max(500).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'Nepřihlášeno.' }, { status: 401 });
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Bonusy spravuje Žůžo-labůžo.' }, { status: 403 });
    }

    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Neplatná data.' }, { status: 400 });
    }
    const { caflouProjectId, userId, castka } = parsed.data;

    const [projekt, zvukar, uz] = await Promise.all([
      prisma.projectMeta.findUnique({ where: { caflouProjectId }, select: { name: true } }),
      prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true } }),
      prisma.bonusZvukare.findUnique({
        where: { caflouProjectId_userId: { caflouProjectId, userId } },
        select: { id: true },
      }),
    ]);
    if (!projekt) return NextResponse.json({ error: 'Projekt nenalezen.' }, { status: 404 });
    if (!zvukar) return NextResponse.json({ error: 'Uživatel nenalezen.' }, { status: 404 });
    if (uz) {
      return NextResponse.json(
        { error: 'Tenhle člověk už u tohohle projektu bonus vedený má.' },
        { status: 409 },
      );
    }

    /**
     * Podíl na střihu se dopočítá, pokud výkazy jsou - je to užitečný
     * kontext i u ručního bonusu. Když nejsou, zůstanou nuly a v tabulce se
     * místo procent píše „ručně".
     */
    const vykazy = await prisma.timesheetEntry.findMany({
      where: { caflouProjectId, workType: 'EDITING' },
      select: { userId: true, startMinutes: true, endMinutes: true },
    });
    let minutCelkem = 0;
    let minutZvukare = 0;
    for (const v of vykazy) {
      const minut = durationMinutes(v.startMinutes, v.endMinutes);
      minutCelkem += minut;
      if (v.userId === userId) minutZvukare += minut;
    }
    const podil = minutCelkem > 0 ? Math.round((minutZvukare / minutCelkem) * 100) : 0;

    // Bonus sam sobe nejde schvalit - zustane jako navrh pro kolegu.
    const sobe = userId === session.user.id;
    const kdo = session.user.name || session.user.email || null;

    await prisma.bonusZvukare.create({
      data: {
        caflouProjectId,
        projectName: projekt.name,
        userId,
        castka,
        podilProcent: podil,
        minutZvukare,
        minutCelkem,
        rucne: true,
        poznamka: parsed.data.poznamka || null,
        ...(sobe
          ? {}
          : {
              stav: 'SCHVALENO' as const,
              rozhodnutoAt: new Date(),
              rozhodlId: session.user.id,
              rozhodlJmeno: kdo,
            }),
      },
    });

    return NextResponse.json({ ok: true, ceka: sobe });
  } catch (err) {
    console.error('POST /api/bonusy selhalo:', err);
    return NextResponse.json({ error: 'Bonus se nepodařilo přidat.' }, { status: 500 });
  }
}
