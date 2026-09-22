import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/adminGuard';
import { prisma } from '@/lib/db';
import { JAZYKY_WIKI } from '@/lib/wikipedie';

/**
 * Koncept článku na Wikipedii (zadání 22. 9. 2026). Každý si ukládá jen svůj
 * - jeden článek na účet. Změněný text se uloží i jako verze (nejvýš 50).
 */
export const dynamic = 'force-dynamic';

const MAX_VERZI = 50;

const schema = z.object({
  jazyk: z.enum(JAZYKY_WIKI),
  nazev: z.string().trim().min(1, 'Vyplňte název článku.').max(200),
  wikitext: z.string().max(300_000),
  // Formulář „Údaje" - ukládá se, jak přišel; skládá se z něj wikitext.
  udaje: z.unknown().optional(),
  sledovanyNazev: z.string().trim().max(200).optional().nullable(),
});

export async function PUT(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Neplatná data.' }, { status: 400 });
  }
  const d = parsed.data;
  const userId = session.user.id;
  const pred = await prisma.wikiClanek.findUnique({ where: { userId } });
  const sledovany = d.sledovanyNazev?.trim() || null;

  const clanek = await prisma.wikiClanek.upsert({
    where: { userId },
    create: { userId, jazyk: d.jazyk, nazev: d.nazev, wikitext: d.wikitext, sledovanyNazev: sledovany, udaje: (d.udaje ?? null) as object | null },
    update: {
      jazyk: d.jazyk,
      nazev: d.nazev,
      wikitext: d.wikitext,
      ...(d.udaje !== undefined ? { udaje: d.udaje as object | null } : {}),
      sledovanyNazev: sledovany,
      // Jiný hlídaný článek = začíná se znovu (první kontrola si jen zapamatuje revizi).
      ...(pred && (pred.sledovanyNazev !== sledovany || pred.jazyk !== d.jazyk)
        ? { posledniRevize: null, posledniKontrola: null, chybaKontroly: null }
        : {}),
    },
  });

  if (!pred || pred.wikitext !== d.wikitext) {
    await prisma.wikiVerze.create({
      data: { clanekId: clanek.id, wikitext: d.wikitext, autor: session.user.name || session.user.email || null },
    });
    const stare = await prisma.wikiVerze.findMany({
      where: { clanekId: clanek.id },
      orderBy: { createdAt: 'desc' },
      skip: MAX_VERZI,
      select: { id: true },
    });
    if (stare.length) await prisma.wikiVerze.deleteMany({ where: { id: { in: stare.map((v) => v.id) } } });
  }

  const verze = await prisma.wikiVerze.findMany({
    where: { clanekId: clanek.id },
    orderBy: { createdAt: 'desc' },
    take: MAX_VERZI,
    select: { id: true, createdAt: true, autor: true },
  });
  return NextResponse.json({
    ok: true,
    ulozeno: clanek.updatedAt.toISOString(),
    verze: verze.map((v) => ({ id: v.id, kdy: v.createdAt.toISOString(), autor: v.autor })),
  });
}

/** Text jedné uložené verze (?verze=id) - jen z vlastního článku. */
export async function GET(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  const id = req.nextUrl.searchParams.get('verze');
  if (!id) return NextResponse.json({ error: 'Chybí verze.' }, { status: 400 });
  const clanek = await prisma.wikiClanek.findUnique({ where: { userId: session.user.id }, select: { id: true } });
  const verze = clanek ? await prisma.wikiVerze.findFirst({ where: { id, clanekId: clanek.id } }) : null;
  if (!verze) return NextResponse.json({ error: 'Verze nenalezena.' }, { status: 404 });
  return NextResponse.json({ wikitext: verze.wikitext });
}
