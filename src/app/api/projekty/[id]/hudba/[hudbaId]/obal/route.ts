import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { obalSkladby } from '@/lib/hudbaProjektuServer';
import { isInternalRole } from '@/lib/roles';
import { podepsanyOdkazNaPrilohu } from '@/lib/storage';

/**
 * OBAL SKLADBY Z METADAT (zadání 17. 10. 2026: „pokud je v metadatech fotka,
 * tak ji zobrazit").
 *
 * Úložiště je soukromé, takže se na obrázek nedá odkázat napřímo - adresa se
 * musí podepsat. Obrázek se sem nestahuje a nepřeposílá; odpověď je jen
 * přesměrování na podepsanou adresu, stejně jako u profilových fotek.
 */
export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ hudbaId: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isInternalRole(session.user.role)) {
    return new NextResponse(null, { status: 403 });
  }

  const { hudbaId } = await params;
  const klic = await obalSkladby(hudbaId);
  if (!klic) return new NextResponse(null, { status: 404 });

  const odkaz = await podepsanyOdkazNaPrilohu(klic, 'obal.jpg');
  if (!odkaz) return new NextResponse(null, { status: 404 });
  return NextResponse.redirect(odkaz);
}
