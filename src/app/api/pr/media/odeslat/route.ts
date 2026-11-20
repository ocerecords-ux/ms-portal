import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';

import { authOptions } from '@/lib/auth';
import { odpovedChyby } from '@/lib/chybyApi';
import { nactiMedia } from '@/lib/emaServer';
import { posliMedium } from '@/lib/prOdeslaniServer';
import { isInternalRole } from '@/lib/roles';

/**
 * Odeslání nabídky médiu (zadání 20. 11. 2026). Mačká to člověk u konkrétního
 * řádku; portál sám nic neposílá. Vrací celý seznam médií, ať se obrazovka
 * překreslí i se stavem „nabídnuto" a datem.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const schema = z.object({
  kampanId: z.string().trim().min(1),
  mediumId: z.string().trim().min(1),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !isInternalRole(session.user.role)) {
    return odpovedChyby('chybaApi.bezOpravneni', 403);
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return odpovedChyby('chybaApi.neplatnaData', 400);

  const vysledek = await posliMedium(parsed.data.mediumId, {
    id: session.user.id,
    jmeno: session.user.name || session.user.email || 'Mediaspace',
  });

  if (!vysledek.ok) {
    return NextResponse.json(
      { error: vysledek.duvod, media: await nactiMedia(parsed.data.kampanId) },
      { status: 409 },
    );
  }
  return NextResponse.json({
    adresa: vysledek.adresa,
    media: await nactiMedia(parsed.data.kampanId),
  });
}
