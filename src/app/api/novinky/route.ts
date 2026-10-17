import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';

import { authOptions } from '@/lib/auth';
import { zalozNovinku } from '@/lib/novinkyServer';

/**
 * NOVINKY PORTÁLU (zadání 17. 10. 2026). Zakládá je Žůžo-labůžo; tým je jen
 * čte na stránce Novinky.
 */
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

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }
  const telo = schema.safeParse(await req.json().catch(() => null));
  if (!telo.success) return NextResponse.json({ error: 'Nesprávná data.' }, { status: 400 });
  try {
    const id = await zalozNovinku(telo.data);
    return NextResponse.json({ id });
  } catch (chyba) {
    const text = chyba instanceof Error ? chyba.message : 'Novinku se nepodařilo uložit.';
    return NextResponse.json({ error: text }, { status: 400 });
  }
}
