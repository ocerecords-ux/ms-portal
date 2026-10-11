import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { iceProPult } from '@/lib/pultIceServer';

/**
 * ÚDAJE K PŘEPOSÍLACÍMU SERVERU PRO JEDNU MÍSTNOST (zadání 11. 10. 2026).
 *
 * Schválně samostatná adresa, a ne součást stránky: údaje k TURNu mají
 * krátkou platnost a nemají se vypéct do HTML, které si prohlížeč ukládá.
 * Vydají se, až když někdo opravdu vstupuje do natáčení.
 *
 * KDO SE ZEPTÁ: jen ten, kdo zná token místnosti. Je to tentýž token, který
 * pouští do hovoru - kdo ho má, je stejně uvnitř, takže se tím nic nepřidává.
 * Bez něj se nevydá nic, aby z pultu nebyla veřejná přeposílačka.
 */
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { token: string } }) {
  const mistnost = await prisma.studioBlock
    .findUnique({ where: { pultToken: params.token }, select: { id: true } })
    .catch(() => null);
  if (!mistnost) return NextResponse.json({ chyba: 'Místnost neexistuje.' }, { status: 404 });

  const ice = await iceProPult();
  return NextResponse.json(ice, {
    // Údaje mají omezenou platnost - ať je prohlížeč ani Vercel nedrží.
    headers: { 'Cache-Control': 'no-store' },
  });
}
