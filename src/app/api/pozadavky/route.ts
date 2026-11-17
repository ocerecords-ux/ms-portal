import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { isInternalRole } from '@/lib/roles';
import {
  filtrStudii,
  pristupKPozadavkum,
  smiDoStudia,
  smiNaSeznam,
} from '@/lib/pozadavkyStudii';

/**
 * CO JE POTŘEBA VE STUDIÍCH (zadání 17. 11. 2026) - seznam v záložce chatu.
 *
 * Kdo co vidí, řeší lib/pozadavkyStudii.ts; tahle routa jen dotáhne data
 * a nedůvěřuje ničemu, co přijde v těle - studio se vždycky znovu ověří.
 */
const schema = z.object({
  studioId: z.string().trim().min(1, 'Vyberte studio.'),
  druh: z.enum(['KOUPIT', 'UDELAT']),
  text: z.string().trim().min(1, 'Napište, co je potřeba.').max(300),
  popis: z.string().trim().max(2000).nullable().optional(),
  specha: z.boolean().optional(),
});

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !isInternalRole(session.user.role)) {
      return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
    }

    const pristup = await pristupKPozadavkum(session.user.id, session.user.role);
    if (!smiNaSeznam(pristup)) {
      return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
    }

    const pozadavky = await prisma.pozadavekStudia.findMany({
      where: filtrStudii(pristup),
      orderBy: [{ specha: 'desc' }, { createdAt: 'desc' }],
      take: 300,
      select: {
        id: true,
        studioId: true,
        druh: true,
        text: true,
        popis: true,
        specha: true,
        stav: true,
        createdAt: true,
        vyrizenoAt: true,
        vyrizeniPoznamka: true,
        zadalId: true,
        zadal: { select: { name: true } },
        vyridil: { select: { name: true } },
        studio: { select: { shortName: true, name: true } },
      },
    });

    // Studia do rozbalovátka - jen ta, do kterých ten člověk smí psát.
    const studia = await prisma.studio.findMany({
      where: {
        active: true,
        ...(pristup.spravce ? {} : { id: { in: pristup.vedeStudia } }),
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, shortName: true },
    });

    return NextResponse.json({
      spravce: pristup.spravce,
      jaId: session.user.id,
      studia,
      pozadavky: pozadavky.map((p) => ({
        id: p.id,
        studioId: p.studioId,
        studio: p.studio.shortName || p.studio.name,
        druh: p.druh,
        text: p.text,
        popis: p.popis,
        specha: p.specha,
        stav: p.stav,
        zadal: p.zadal?.name ?? null,
        jeMuj: p.zadalId === session.user.id,
        vyridil: p.vyridil?.name ?? null,
        vyrizeniPoznamka: p.vyrizeniPoznamka,
        createdAt: p.createdAt.toISOString(),
        vyrizenoAt: p.vyrizenoAt ? p.vyrizenoAt.toISOString() : null,
      })),
    });
  } catch (err) {
    console.error('GET /api/pozadavky selhalo:', err);
    return NextResponse.json({ error: 'Seznam se nepodařilo načíst.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !isInternalRole(session.user.role)) {
      return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
    }

    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Neplatná data.' },
        { status: 400 },
      );
    }

    const pristup = await pristupKPozadavkum(session.user.id, session.user.role);
    // Studio se overuje tady, ne v klientovi - do ciziho studia nikdo nic
    // nezapise, ani kdyby si ID podstrcil sam.
    if (!smiDoStudia(pristup, parsed.data.studioId)) {
      return NextResponse.json({ error: 'K tomuhle studiu nemáte přístup.' }, { status: 403 });
    }

    await prisma.pozadavekStudia.create({
      data: {
        studioId: parsed.data.studioId,
        druh: parsed.data.druh,
        text: parsed.data.text,
        popis: parsed.data.popis?.trim() || null,
        specha: parsed.data.specha ?? false,
        zadalId: session.user.id,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('POST /api/pozadavky selhalo:', err);
    return NextResponse.json({ error: 'Uložení se nezdařilo.' }, { status: 500 });
  }
}
