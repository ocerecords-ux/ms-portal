import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { isInternalRole } from '@/lib/roles';

/**
 * Záznamy chyb z přeposlechu nahrávky (AudioTagger) — zadání 11. 9. 2026.
 *
 * Vidí a zapisuje jen tým Mediaspace. Klient ani herec se sem nedostanou.
 *
 * `[id]` je ID projektu; stopy se neukládají, záznam ukazuje na stopu jejím
 * pořadím a nese i její název — viz komentář u modelu v schema.prisma.
 */
export const dynamic = 'force-dynamic';

async function overInterniPristup() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { chyba: NextResponse.json({ error: 'Nepřihlášeno.' }, { status: 401 }) };
  }
  if (!isInternalRole(session.user.role)) {
    return { chyba: NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 }) };
  }
  return { userId: session.user.id, jmeno: session.user.name || session.user.email || null };
}

async function stav(caflouProjectId: string) {
  const [chyby, preposlech] = await Promise.all([
    prisma.preposlechChyba.findMany({
      where: { caflouProjectId },
      orderBy: [{ trackIndex: 'asc' }, { localTime: 'asc' }],
      take: 2000,
    }),
    prisma.preposlechStav.findUnique({ where: { caflouProjectId } }),
  ]);

  return {
    reviewed: Boolean(preposlech?.reviewed),
    reviewedByName: preposlech?.reviewedByName ?? null,
    reviewedAt: preposlech?.reviewedAt ? preposlech.reviewedAt.toISOString() : null,
    chyby: chyby.map((ch) => ({
      id: ch.id,
      trackIndex: ch.trackIndex,
      trackName: ch.trackName,
      localTime: ch.localTime,
      pdfPage: ch.pdfPage,
      description: ch.description,
      createdByName: ch.createdByName,
      createdAt: ch.createdAt.toISOString(),
    })),
  };
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const pristup = await overInterniPristup();
  if ('chyba' in pristup) return pristup.chyba;
  return NextResponse.json(await stav(params.id));
}

const novaChyba = z.object({
  trackIndex: z.number().int().min(1).max(999),
  trackName: z.string().trim().min(1).max(300),
  localTime: z.number().min(0).max(24 * 3600),
  pdfPage: z.number().int().min(1).max(10000).nullable().optional(),
  description: z.string().trim().min(1).max(4000),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const pristup = await overInterniPristup();
  if ('chyba' in pristup) return pristup.chyba;

  const parsed = novaChyba.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Neplatná data.' }, { status: 400 });
  }

  await prisma.preposlechChyba.create({
    data: {
      caflouProjectId: params.id,
      ...parsed.data,
      pdfPage: parsed.data.pdfPage ?? null,
      createdByUserId: pristup.userId,
      createdByName: pristup.jmeno,
    },
  });

  return NextResponse.json(await stav(params.id));
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const pristup = await overInterniPristup();
  if ('chyba' in pristup) return pristup.chyba;

  const telo = await req.json().catch(() => ({}));
  const reviewed = Boolean((telo as { reviewed?: unknown })?.reviewed);

  await prisma.preposlechStav.upsert({
    where: { caflouProjectId: params.id },
    create: {
      caflouProjectId: params.id,
      reviewed,
      reviewedAt: reviewed ? new Date() : null,
      reviewedByName: reviewed ? pristup.jmeno : null,
    },
    update: {
      reviewed,
      reviewedAt: reviewed ? new Date() : null,
      reviewedByName: reviewed ? pristup.jmeno : null,
    },
  });

  return NextResponse.json(await stav(params.id));
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const pristup = await overInterniPristup();
  if ('chyba' in pristup) return pristup.chyba;

  const chybaId = req.nextUrl.searchParams.get('chyba');
  if (!chybaId) return NextResponse.json({ error: 'Chybí ID záznamu.' }, { status: 400 });

  // Mazat smi kdokoliv z tymu - preposlech delaji ve dvou a opravovat cizi
  // preklep je bezna vec.
  await prisma.preposlechChyba.deleteMany({ where: { id: chybaId, caflouProjectId: params.id } });

  return NextResponse.json(await stav(params.id));
}
