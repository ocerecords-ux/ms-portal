import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { authOptions } from '@/lib/auth';
import { isInternalRole } from '@/lib/roles';
import { SEKCE } from '@/lib/prezentaceNabidky';
import {
  nactiProUpravy,
  nastavUkazky,
  upravPrezentaci,
} from '@/lib/prezentaceServer';

/** Úpravy jedné prezentace (11. 10. 2026). */
export const dynamic = 'force-dynamic';

const schema = z.object({
  nadpis: z.string().trim().max(200).nullable().optional(),
  podtitul: z.string().trim().max(2000).nullable().optional(),
  klientNazev: z.string().trim().max(200).optional(),
  navrhReseni: z.string().trim().max(20_000).nullable().optional(),
  podminky: z.string().trim().max(20_000).nullable().optional(),
  offerId: z.string().trim().max(64).nullable().optional(),
  zverejneno: z.boolean().optional(),
  lzeSchvalit: z.boolean().optional(),
  reference: z.array(z.string().max(64)).max(40).optional(),
  herci: z.array(z.string().max(64)).max(40).optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string; prezId: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !isInternalRole(session.user.role)) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }
  const prez = await nactiProUpravy(params.prezId);
  if (!prez || prez.caflouProjectId !== params.id) {
    return NextResponse.json({ error: 'Prezentace nenalezena.' }, { status: 404 });
  }
  return NextResponse.json({ prezentace: prez });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; prezId: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !isInternalRole(session.user.role)) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }

  const puvodni = await nactiProUpravy(params.prezId);
  if (!puvodni || puvodni.caflouProjectId !== params.id) {
    return NextResponse.json({ error: 'Prezentace nenalezena.' }, { status: 404 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Neplatná data.' }, { status: 400 });
  }
  const { reference, herci, ...zbytek } = parsed.data;

  /**
   * Doklad musí patřit k témuž projektu. Jinak by se dal odkazem na cizí
   * nabídku vypsat klientovi ceník někoho jiného.
   */
  if (zbytek.offerId) {
    const doklad = await prisma.offer
      .findUnique({ where: { id: zbytek.offerId }, select: { caflouProjectId: true } })
      .catch(() => null);
    if (!doklad || doklad.caflouProjectId !== params.id) {
      return NextResponse.json({ error: 'Tahle nabídka k projektu nepatří.' }, { status: 400 });
    }
  }

  if (Object.keys(zbytek).length > 0 && !(await upravPrezentaci(params.prezId, zbytek))) {
    return NextResponse.json({ error: 'Uložení se nepovedlo.' }, { status: 500 });
  }
  if (reference && !(await nastavUkazky(params.prezId, SEKCE.reference, reference))) {
    return NextResponse.json({ error: 'Reference se nepodařilo uložit.' }, { status: 500 });
  }
  if (herci && !(await nastavUkazky(params.prezId, SEKCE.herec, herci))) {
    return NextResponse.json({ error: 'Herce se nepodařilo uložit.' }, { status: 500 });
  }

  return NextResponse.json({ prezentace: await nactiProUpravy(params.prezId) });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; prezId: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !isInternalRole(session.user.role)) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }
  const prez = await nactiProUpravy(params.prezId);
  if (!prez || prez.caflouProjectId !== params.id) {
    return NextResponse.json({ error: 'Prezentace nenalezena.' }, { status: 404 });
  }
  const ok = await prisma.prezentaceNabidky
    .delete({ where: { id: params.prezId }, select: { id: true } })
    .catch(() => null);
  if (!ok) return NextResponse.json({ error: 'Smazání se nepovedlo.' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
