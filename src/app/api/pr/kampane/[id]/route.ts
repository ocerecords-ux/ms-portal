import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';

import { authOptions } from '@/lib/auth';
import { odpovedChyby } from '@/lib/chybyApi';
import { STAVY_KAMPANE } from '@/lib/ema';
import { nactiKampan, nactiMedia, nactiUkoly, upravKampan } from '@/lib/emaServer';
import { isInternalRole } from '@/lib/roles';

/** Jedna kampaň: co je v ní, a úprava názvu, briefu a stavu (19. 11. 2026). */
export const dynamic = 'force-dynamic';

async function ja() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !isInternalRole(session.user.role)) return null;
  return session.user;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await ja())) return odpovedChyby('chybaApi.bezOpravneni', 403);
  const { id } = await params;
  const kampan = await nactiKampan(id);
  if (!kampan) return odpovedChyby('chybaApi.odkazNeplati', 404);
  return NextResponse.json({
    kampan,
    ukoly: await nactiUkoly(id),
    media: await nactiMedia(id),
  });
}

const schema = z.object({
  nazev: z.string().trim().min(1).max(200).optional(),
  brief: z.string().trim().max(20000).optional(),
  stav: z.enum(STAVY_KAMPANE).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await ja())) return odpovedChyby('chybaApi.bezOpravneni', 403);
  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return odpovedChyby('chybaApi.neplatnaData', 400);
  await upravKampan(id, parsed.data);
  return NextResponse.json({ kampan: await nactiKampan(id) });
}
