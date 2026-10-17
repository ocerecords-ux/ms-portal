import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';

import { authOptions } from '@/lib/auth';
import { smazNovinku, upravNovinku } from '@/lib/novinkyServer';

/** Úprava a smazání jedné novinky (17. 10. 2026). Jen Žůžo-labůžo. */
export const dynamic = 'force-dynamic';

const schema = z.object({
  datum: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  nazev: z.string().trim().min(1).max(200),
  popis: z.string().trim().max(4000),
  proNewsletter: z.string().trim().max(4000).nullable().optional(),
  modul: z.string().trim().max(60).optional(),
  typ: z.string().trim().max(20).optional(),
  publikum: z.array(z.string().trim().max(30)).max(10).optional(),
  zverejneno: z.boolean().optional(),
});

async function straz() {
  const session = await getServerSession(authOptions);
  return session?.user?.role === 'ADMIN';
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await straz())) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  const telo = schema.safeParse(await req.json().catch(() => null));
  if (!telo.success) return NextResponse.json({ error: 'Nesprávná data.' }, { status: 400 });
  try {
    await upravNovinku(params.id, telo.data);
    return NextResponse.json({ ok: true });
  } catch (chyba) {
    const text = chyba instanceof Error ? chyba.message : 'Novinku se nepodařilo uložit.';
    return NextResponse.json({ error: text }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await straz())) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  await smazNovinku(params.id).catch(() => undefined);
  return NextResponse.json({ ok: true });
}
