import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';

import { authOptions } from '@/lib/auth';
import { odpovedChyby } from '@/lib/chybyApi';
import { DRUHY_MEDIA, STAVY_MEDIA } from '@/lib/ema';
import { nactiMedia, smazMedium, upravMedium } from '@/lib/emaServer';
import { isInternalRole } from '@/lib/roles';

/**
 * Jedno médium v kampani (19. 11. 2026). Změna stavu, kontaktu nebo textu
 * mailu; smazání. Portál sám nic neodesílá - „nabídnuto" si odškrtne člověk
 * a tím se zapíše, kdy to odešlo a kdo to poslal.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  nazev: z.string().trim().min(1).max(200).optional(),
  druh: z.enum(DRUHY_MEDIA).optional(),
  kontakt: z.string().trim().max(300).optional(),
  odkaz: z.string().trim().max(500).optional(),
  duvod: z.string().trim().max(4000).optional(),
  stav: z.enum(STAVY_MEDIA).optional(),
  predmet: z.string().trim().max(300).optional(),
  textMailu: z.string().trim().max(8000).optional(),
  poznamka: z.string().trim().max(4000).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; mediumId: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !isInternalRole(session.user.role)) {
    return odpovedChyby('chybaApi.bezOpravneni', 403);
  }
  const { id, mediumId } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return odpovedChyby('chybaApi.neplatnaData', 400);
  await upravMedium(mediumId, parsed.data, session.user.id);
  return NextResponse.json({ media: await nactiMedia(id) });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; mediumId: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !isInternalRole(session.user.role)) {
    return odpovedChyby('chybaApi.bezOpravneni', 403);
  }
  const { id, mediumId } = await params;
  await smazMedium(mediumId);
  return NextResponse.json({ media: await nactiMedia(id) });
}
