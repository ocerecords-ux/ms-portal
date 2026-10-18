import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { odpovedChyby } from '@/lib/chybyApi';
import { isInternalRole } from '@/lib/roles';
import { podepsanyUploadObaluHudby } from '@/lib/storage';

/**
 * ADRESA NA NAHRÁNÍ OBALU (17. 10. 2026).
 *
 * Obal se vyřízne z metadat a zmenší ještě v prohlížeči, takže by se do
 * požadavku vešel - do úložiště ale jde stejnou cestou jako ostatní obrázky,
 * tedy rovnou z prohlížeče na podepsanou adresu. Klíč určuje server; kdyby
 * ho posílal prohlížeč, dal by se jím přepsat cizí soubor.
 */
export const dynamic = 'force-dynamic';

export async function POST(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isInternalRole(session.user.role)) {
    return odpovedChyby('chybaApi.bezOpravneni', 403);
  }
  const podpis = await podepsanyUploadObaluHudby('obal');
  if (!podpis) {
    return odpovedChyby('chybaApi.uloznisteNeniNastavene', 503);
  }
  return NextResponse.json(podpis);
}
