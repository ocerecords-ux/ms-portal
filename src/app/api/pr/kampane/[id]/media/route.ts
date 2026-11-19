import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';

import { authOptions } from '@/lib/auth';
import { odpovedChyby } from '@/lib/chybyApi';
import { DRUHY_MEDIA } from '@/lib/ema';
import { nactiMedia, pridejMedium } from '@/lib/emaServer';
import { isInternalRole } from '@/lib/roles';

/** Seznam médií v kampani a přidání dalšího (19. 11. 2026). */
export const dynamic = 'force-dynamic';

async function smi() {
  const session = await getServerSession(authOptions);
  return Boolean(session?.user?.id && isInternalRole(session.user.role));
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await smi())) return odpovedChyby('chybaApi.bezOpravneni', 403);
  const { id } = await params;
  return NextResponse.json({ media: await nactiMedia(id) });
}

const schema = z.object({
  nazev: z.string().trim().min(1).max(200),
  druh: z.enum(DRUHY_MEDIA).optional(),
  kontakt: z.string().trim().max(300).optional(),
  odkaz: z.string().trim().max(500).optional(),
  duvod: z.string().trim().max(4000).optional(),
  predmet: z.string().trim().max(300).optional(),
  textMailu: z.string().trim().max(8000).optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await smi())) return odpovedChyby('chybaApi.bezOpravneni', 403);
  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return odpovedChyby('chybaApi.neplatnaData', 400);
  await pridejMedium(id, parsed.data);
  return NextResponse.json({ media: await nactiMedia(id) });
}
