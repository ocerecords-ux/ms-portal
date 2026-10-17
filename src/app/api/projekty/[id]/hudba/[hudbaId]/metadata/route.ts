import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { doplnMetadataSkladby } from '@/lib/doplnMetadataServer';
import { nactiHudbu } from '@/lib/hudbaProjektuServer';
import { isInternalRole } from '@/lib/roles';

/**
 * DOČTENÍ ÚDAJŮ ZE SOUBORU (17. 10. 2026: „tady se nepropisují autor a název
 * skladby. v metadatech přitom jsou. taky i obrázek").
 *
 * Týká se skladeb vložených dřív, než portál uměl metadata číst. Stahuje se
 * jen začátek souboru z Dropboxu (hlavička `Range`), ne celých padesát
 * megabajtů - viz lib/doplnMetadataServer.ts.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; hudbaId: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isInternalRole(session.user.role)) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }

  const { id, hudbaId } = await params;
  const vysledek = await doplnMetadataSkladby(hudbaId);
  const hudba = await nactiHudbu(id);
  return NextResponse.json({ ...vysledek, skladba: hudba.find((s) => s.id === hudbaId) ?? null });
}
