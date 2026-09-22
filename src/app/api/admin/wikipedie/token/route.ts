import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/adminGuard';
import { prisma } from '@/lib/db';
import { vychoziKoncept } from '@/lib/wikipedie';

/**
 * Přístupový token k Wikipedii (zadání 22. 9. 2026). Uloží se a už se nikdy
 * nevrací - formulář o něm ví jen to, jestli uložený je. Prázdná hodnota
 * token smaže.
 */
export const dynamic = 'force-dynamic';

// Token z Wikimedie je JWT a bývá přes tisíc znaků - krátký limit ho odmítal.
const schema = z.object({ token: z.string().trim().max(8000) });

export async function PUT(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Neplatná data.' }, { status: 400 });

  const token = parsed.data.token || null;
  const userId = session.user.id;
  const vychozi = vychoziKoncept(session.user.name || '');
  await prisma.wikiClanek.upsert({
    where: { userId },
    create: { userId, nazev: vychozi.nazev, wikitext: vychozi.wikitext, token },
    update: { token },
  });
  return NextResponse.json({ ok: true, ulozen: Boolean(token) });
}
