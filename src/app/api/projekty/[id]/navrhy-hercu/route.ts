import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canEditProjectMeta } from '@/lib/roles';

/**
 * NÁVRHY HERCŮ K PROJEKTU (zadání 22. 10. 2026: „chtěl bych mít někde ještě
 * u projektu možnost přidat mé návrhy herců. Nějaká pole 1. 2. 3., ale aby se
 * to nemotalo do herců u projektu").
 *
 * NENÍ TO OBSAZENÍ. Obsazení žije v `ProjectMeta.actorUserIds` a tisknou se
 * z něj rodné listy i smlouvy; tohle je poznámka, koho zvažujeme. Proto taky
 * vlastní tabulka a vlastní routa - kdyby to byl další sloupec u projektu,
 * dřív nebo později by se to někde připletlo mezi skutečné herce.
 *
 * KDO: admin a produkce (`canEditProjectMeta`). Zvukař, herec ani klient
 * o návrzích nevědí.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  /** Herec s účtem v portálu - pak jde návrh překlopit do obsazení. */
  userId: z.string().trim().min(1).nullable().optional(),
  /** Jméno napsané rukou, když herec účet nemá. */
  jmeno: z.string().trim().max(160).nullable().optional(),
  poznamka: z.string().trim().max(500).nullable().optional(),
});

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !canEditProjectMeta(session.user.role)) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }

  const navrhy = await prisma.navrhHerce
    .findMany({
      where: { caflouProjectId: params.id },
      orderBy: [{ poradi: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        poradi: true,
        userId: true,
        jmeno: true,
        poznamka: true,
        autorJmeno: true,
        odeslanoKlientoviAt: true,
        vybranoAt: true,
        vybralKdo: true,
        user: { select: { name: true, email: true } },
      },
    })
    .catch(() => []);

  return NextResponse.json({ navrhy });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !canEditProjectMeta(session.user.role)) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Neplatná data.' }, { status: 400 });
  const { userId, jmeno, poznamka } = parsed.data;
  if (!userId && !jmeno?.trim()) {
    return NextResponse.json({ error: 'Vyberte herce nebo napište jméno.' }, { status: 400 });
  }

  try {
    const posledni = await prisma.navrhHerce.findFirst({
      where: { caflouProjectId: params.id },
      orderBy: { poradi: 'desc' },
      select: { poradi: true },
    });

    const navrh = await prisma.navrhHerce.create({
      data: {
        caflouProjectId: params.id,
        poradi: (posledni?.poradi ?? 0) + 1,
        userId: userId ?? null,
        // Jmeno drzime jen u nekoho zvenci - u herce s uctem by se po
        // prejmenovani rozeslo s tim, co je na jeho karte.
        jmeno: userId ? null : jmeno?.trim() || null,
        poznamka: poznamka?.trim() || null,
        autorJmeno: session.user.name || session.user.email || null,
      },
      select: { id: true },
    });
    return NextResponse.json({ ok: true, id: navrh.id });
  } catch (err) {
    console.error('POST navrhy-hercu selhalo:', err);
    return NextResponse.json({ error: 'Uložení se nepodařilo.' }, { status: 500 });
  }
}
