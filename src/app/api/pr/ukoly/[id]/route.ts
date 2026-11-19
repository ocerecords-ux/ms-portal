import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { odpovedChyby } from '@/lib/chybyApi';
import { nactiUkol } from '@/lib/emaServer';
import { isInternalRole } from '@/lib/roles';

/**
 * STAV JEDNOHO ÚKOLU (19. 11. 2026) - obrazovka se sem ptá, dokud Ema pracuje,
 * aby bylo vidět, co zrovna dělá.
 */
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !isInternalRole(session.user.role)) {
    return odpovedChyby('chybaApi.bezOpravneni', 403);
  }
  const { id } = await params;
  const ukol = await nactiUkol(id);
  if (!ukol) return odpovedChyby('chybaApi.odkazNeplati', 404);
  return NextResponse.json({ ukol });
}
