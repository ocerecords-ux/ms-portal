import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/db';
import { upravPoznamku } from '@/lib/hudbaProjektuServer';
import { rozesliUpravuDoSerie } from '@/lib/hudbaSerieServer';

/**
 * POZNÁMKA KE SKLADBĚ OD KLIENTA (zadání 17. 10. 2026: „klient pro vkládání
 * u hudby by měl mít taky možnost poznámky ke každému tracku").
 *
 * Mění se JEN poznámka a JEN u skladby, která patří k projektu z tokenu -
 * jinak by se cizím odkazem dalo psát do kterékoliv skladby v portálu.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({ poznamka: z.string().trim().max(500).nullable() });

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ token: string; hudbaId: string }> },
) {
  const { token, hudbaId } = await params;
  const vyzva = (await prisma.vyzvaHudba
    .findUnique({ where: { token }, select: { caflouProjectId: true } })
    .catch(() => null)) as { caflouProjectId: string } | null;
  if (!vyzva) return NextResponse.json({ error: 'Odkaz neplatí.' }, { status: 404 });

  const skladba = (await prisma.hudbaProjektu
    .findUnique({ where: { id: hudbaId }, select: { caflouProjectId: true } })
    .catch(() => null)) as { caflouProjectId: string } | null;
  if (!skladba || skladba.caflouProjectId !== vyzva.caflouProjectId) {
    return NextResponse.json({ error: 'Skladba sem nepatří.' }, { status: 404 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Neplatná data.' }, { status: 400 });

  const ok = await upravPoznamku(hudbaId, parsed.data.poznamka);
  // Poznámka klienta platí pro celou sérii stejně jako naše (17. 10. 2026).
  if (ok) await rozesliUpravuDoSerie({ hudbaId });
  return NextResponse.json({ ok }, { status: ok ? 200 : 500 });
}
