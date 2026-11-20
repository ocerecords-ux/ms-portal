import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { odpovedChyby } from '@/lib/chybyApi';
import { navrhniHromadnyMail } from '@/lib/emaServer';
import { isInternalRole } from '@/lib/roles';

/**
 * NÁVRH HROMADNÉHO MAILU OD EMY (zadání 20. 11. 2026: „a tady musí být návrh
 * toho mailu, abych ho jen upravil"). Nic neukládá - text se vrátí do polí
 * a uloží se, až ho člověk pošle dál tlačítkem.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !isInternalRole(session.user.role)) {
    return odpovedChyby('chybaApi.bezOpravneni', 403);
  }
  const { id } = await params;
  const navrh = await navrhniHromadnyMail(id, {
    id: session.user.id,
    jmeno: session.user.name || session.user.email || 'Mediaspace',
  });
  if (!navrh) return odpovedChyby('chybaApi.neplatnaData', 409);
  return NextResponse.json(navrh);
}
