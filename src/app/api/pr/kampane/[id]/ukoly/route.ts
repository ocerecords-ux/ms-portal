import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';

import { authOptions } from '@/lib/auth';
import { odpovedChyby } from '@/lib/chybyApi';
import { jeEmaNastavena } from '@/lib/emaAgent';
import { nactiUkoly, zadejUkol } from '@/lib/emaServer';
import { isInternalRole } from '@/lib/roles';

/**
 * ZADÁNÍ PRO EMU (19. 11. 2026).
 *
 * Běh může trvat minuty - rešerše médií znamená několik hledání za sebou.
 * Záznam o úkolu vznikne hned a průběh se do něj zapisuje po krocích, takže
 * obrazovka ukazuje, co se děje, i když tahle odpověď ještě nedorazila.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !isInternalRole(session.user.role)) {
    return odpovedChyby('chybaApi.bezOpravneni', 403);
  }
  if (!jeEmaNastavena()) {
    return NextResponse.json({ error: 'Ema teď není k dispozici.' }, { status: 503 });
  }

  const { id } = await params;
  const parsed = z
    .object({ zadani: z.string().trim().min(3).max(8000) })
    .safeParse(await req.json().catch(() => null));
  if (!parsed.success) return odpovedChyby('chybaApi.neplatnaData', 400);

  const ukolId = await zadejUkol(id, parsed.data.zadani, {
    id: session.user.id,
    jmeno: session.user.name || session.user.email || 'kolega',
  });
  if (!ukolId) return odpovedChyby('chybaApi.ulohaNepodarila', 500);
  return NextResponse.json({ ukolId, ukoly: await nactiUkoly(id) });
}
