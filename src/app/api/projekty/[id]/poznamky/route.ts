import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canEditProjectMeta } from '@/lib/roles';
import { nactiPoznamkyProjektu } from '@/lib/poznamkyProjektuServer';

/**
 * POZNÁMKY U PROJEKTU (zadání 23. 9. 2026). Píše a čte je Žůžo-labůžo
 * a produkce - viz lib/poznamkyProjektuServer.ts.
 *
 * Poznámka z objednávky se sem nepíše a nemaže: patří klientovi a čte se
 * rovnou z objednávky.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({ text: z.string().trim().min(1).max(4000) });

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !canEditProjectMeta(session.user.role)) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }
  return NextResponse.json({ poznamky: await nactiPoznamkyProjektu(params.id) });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !canEditProjectMeta(session.user.role)) {
      return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
    }

    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Poznámka je prázdná.' }, { status: 400 });
    }

    await prisma.poznamkaProjektu.create({
      data: {
        caflouProjectId: params.id,
        text: parsed.data.text,
        autorId: session.user.id,
        autorJmeno: session.user.name || session.user.email || 'neznámý',
      },
    });

    return NextResponse.json({ poznamky: await nactiPoznamkyProjektu(params.id) });
  } catch (err) {
    console.error('POST /api/projekty/[id]/poznamky selhalo:', err);
    return NextResponse.json({ error: 'Poznámku se nepodařilo uložit.' }, { status: 500 });
  }
}

/**
 * Smazat smí autor, Žůžo-labůžo kteroukoliv. Produkce tak nesmaže cizí
 * poznámku omylem, ale po sobě si uklidí.
 */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !canEditProjectMeta(session.user.role)) {
      return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
    }

    const poznamkaId = new URL(req.url).searchParams.get('poznamka') ?? '';
    const poznamka = await prisma.poznamkaProjektu.findUnique({ where: { id: poznamkaId } });
    if (!poznamka || poznamka.caflouProjectId !== params.id) {
      return NextResponse.json({ error: 'Poznámka nenalezena.' }, { status: 404 });
    }
    if (poznamka.autorId !== session.user.id && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Smazat ji může jen ten, kdo ji napsal.' }, { status: 403 });
    }

    await prisma.poznamkaProjektu.delete({ where: { id: poznamkaId } });
    return NextResponse.json({ poznamky: await nactiPoznamkyProjektu(params.id) });
  } catch (err) {
    console.error('DELETE /api/projekty/[id]/poznamky selhalo:', err);
    return NextResponse.json({ error: 'Poznámku se nepodařilo smazat.' }, { status: 500 });
  }
}
