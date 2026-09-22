import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/adminGuard';
import { JAZYKY_WIKI } from '@/lib/wikipedie';
import { vykresliNahled } from '@/lib/wikipedieServer';

/** Náhled konceptu tak, jak by vypadal na Wikipedii (zadání 22. 9. 2026). */
export const dynamic = 'force-dynamic';

const schema = z.object({
  jazyk: z.enum(JAZYKY_WIKI),
  nazev: z.string().trim().max(200),
  wikitext: z.string().max(300_000),
});

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Neplatná data.' }, { status: 400 });
  try {
    const html = await vykresliNahled(parsed.data.jazyk, parsed.data.nazev, parsed.data.wikitext);
    return NextResponse.json({ html });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message || 'Náhled se nepodařil.' }, { status: 502 });
  }
}
