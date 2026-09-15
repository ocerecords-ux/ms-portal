import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

/**
 * Rozhodnutí o navrženém bonusu zvukaře (zadání 15. 9. 2026: „navrhne to pak
 * Peterovi Dratvovi na kontrolu, když to odklikne, tak se to zapíše danému
 * zvukaři").
 *
 * Schvaluje Žůžo-labůžo. Zvukař svůj vlastní bonus schválit nemůže — je to
 * jeho odměna, ne jeho rozhodnutí.
 *
 * ROZHODNUTÍ JDE VZÍT ZPĚT (akce „zpet"): překlep v tisících korun se jinak
 * nedá opravit, a mazat záznam by znamenalo ztratit stopu, že se o bonusu
 * vůbec rozhodovalo.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  akce: z.enum(['schvalit', 'zamitnout', 'zpet']),
  poznamka: z.string().trim().max(500).optional(),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'Nepřihlášeno.' }, { status: 401 });
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Bonusy schvaluje Žůžo-labůžo.' }, { status: 403 });
    }

    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'Neplatný požadavek.' }, { status: 400 });

    const bonus = await prisma.bonusZvukare.findUnique({
      where: { id: params.id },
      select: { id: true, userId: true, stav: true },
    });
    if (!bonus) return NextResponse.json({ error: 'Bonus nenalezen.' }, { status: 404 });
    if (bonus.userId === session.user.id) {
      return NextResponse.json({ error: 'Vlastní bonus si schválit nemůžete.' }, { status: 409 });
    }

    const kdo = session.user.name || session.user.email || null;

    if (parsed.data.akce === 'zpet') {
      await prisma.bonusZvukare.update({
        where: { id: bonus.id },
        data: { stav: 'NAVRZENO', rozhodnutoAt: null, rozhodlId: null, rozhodlJmeno: null, poznamka: null },
      });
      return NextResponse.json({ ok: true });
    }

    await prisma.bonusZvukare.update({
      where: { id: bonus.id },
      data: {
        stav: parsed.data.akce === 'schvalit' ? 'SCHVALENO' : 'ZAMITNUTO',
        rozhodnutoAt: new Date(),
        rozhodlId: session.user.id,
        rozhodlJmeno: kdo,
        poznamka: parsed.data.poznamka || null,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('POST /api/bonusy/[id] selhalo:', err);
    return NextResponse.json({ error: 'Rozhodnutí se nepodařilo uložit.' }, { status: 500 });
  }
}
