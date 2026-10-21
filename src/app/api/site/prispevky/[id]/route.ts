import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { odpovedChyby } from '@/lib/chybyApi';
import { authOptions } from '@/lib/auth';
import { nactiPrispevek, smazPrispevek, smiSite, upravPrispevek } from '@/lib/socialniServer';
import type { Platno } from '@/lib/socialni';

/** Jeden příspěvek na sítě - čtení, ukládání, mazání (zadání 27. 9. 2026). */
export const dynamic = 'force-dynamic';

const schema = z.object({
  nazev: z.string().trim().max(200).optional(),
  format: z.string().trim().max(40).optional(),
  platno: z.unknown().optional(),
  popisek: z.string().max(4000).optional(),
  hashtagy: z.string().max(1000).optional(),
  stav: z.enum(['KONCEPT', 'HOTOVO', 'PUBLIKOVANO']).optional(),
  planovanoNa: z.string().max(40).nullable().optional(),
});

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !(await smiSite(session.user.id))) {
    return odpovedChyby('chybaApi.bezOpravneni', 403);
  }
  const prispevek = await nactiPrispevek(session.user.id, params.id);
  if (!prispevek) return odpovedChyby('chybaApi.prispevekNenalezen', 404);
  return NextResponse.json({ prispevek });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !(await smiSite(session.user.id))) {
    return odpovedChyby('chybaApi.bezOpravneni', 403);
  }
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return odpovedChyby('chybaApi.neplatnaData', 400);

  const prispevek = await upravPrispevek(session.user.id, params.id, {
    ...parsed.data,
    platno: parsed.data.platno as Platno | undefined,
  });
  if (!prispevek) return odpovedChyby('chybaApi.prispevekNenalezen', 404);
  return NextResponse.json({ prispevek });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !(await smiSite(session.user.id))) {
    return odpovedChyby('chybaApi.bezOpravneni', 403);
  }
  const ok = await smazPrispevek(session.user.id, params.id);
  if (!ok) return odpovedChyby('chybaApi.prispevekNenalezen', 404);
  return NextResponse.json({ ok: true });
}
