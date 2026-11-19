import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';

import { authOptions } from '@/lib/auth';
import { odpovedChyby } from '@/lib/chybyApi';
import { nactiKampane, zalozKampan } from '@/lib/emaServer';
import { isInternalRole } from '@/lib/roles';

/**
 * KAMPANĚ V SEKCI PR (zadání 19. 11. 2026). Seznam a zakládání.
 * Jen náš tým - je to interní agenda, klient sem nemá co chodit.
 */
export const dynamic = 'force-dynamic';

async function ja() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !isInternalRole(session.user.role)) return null;
  return session.user;
}

export async function GET() {
  if (!(await ja())) return odpovedChyby('chybaApi.bezOpravneni', 403);
  return NextResponse.json({ kampane: await nactiKampane() });
}

const schema = z.object({
  nazev: z.string().trim().min(1).max(200),
  brief: z.string().trim().max(20000).optional().default(''),
});

export async function POST(req: NextRequest) {
  const kdo = await ja();
  if (!kdo) return odpovedChyby('chybaApi.bezOpravneni', 403);

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return odpovedChyby('chybaApi.neplatnaData', 400);

  const id = await zalozKampan(parsed.data.nazev, parsed.data.brief, kdo.id);
  if (!id) return odpovedChyby('chybaApi.ulohaNepodarila', 500);
  return NextResponse.json({ id }, { status: 201 });
}
