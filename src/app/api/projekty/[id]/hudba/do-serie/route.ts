import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { rozsirDoSerie } from '@/lib/hudbaSerieServer';
import { isInternalRole } from '@/lib/roles';

/**
 * DOPLNĚNÍ HUDBY PROJEKTU DO CELÉ SÉRIE (17. 10. 2026).
 *
 * Od 17. 10. 2026 se hudba vložená u jednoho dílu rozejde do série sama, hned
 * při vložení. Tohle je na to, co se vložilo DŘÍV, a na případy, kdy se série
 * k projektu dopsala až potom - jedním kliknutím se srovná, co je rozsypané.
 *
 * Pustit to podruhé nic nezkazí: co už někde leží, se nepřidává znovu.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !isInternalRole(session.user.role)) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }

  const { id } = await params;
  const skladby = (await prisma.hudbaProjektu
    .findMany({ where: { caflouProjectId: id }, orderBy: { createdAt: 'asc' }, select: { id: true } })
    .catch(() => [])) as { id: string }[];

  let serie: string | null = null;
  let dilu = 0;
  for (const s of skladby) {
    const vysledek = await rozsirDoSerie({
      caflouProjectId: id,
      hudbaId: s.id,
      pridalId: session.user.id,
    });
    if (vysledek.serie) serie = vysledek.serie;
    dilu = Math.max(dilu, vysledek.dilu);
  }

  return NextResponse.json({ serie, dilu, skladeb: skladby.length });
}
