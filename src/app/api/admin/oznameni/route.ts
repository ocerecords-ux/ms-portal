import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/adminGuard';
import { KLICE_OZNAMENI, type KlicOznameni } from '@/lib/oznameni';
import { nactiZapnuti, nactiZneni, nastavZapnuti, nastavZneni } from '@/lib/oznameniServer';

/** Zapnutí a vypnutí automatických zpráv portálu (zadání 15. 9. 2026). */
export const dynamic = 'force-dynamic';

const schema = z.object({
  klic: z.string().trim().min(1),
  zapnuto: z.boolean().optional(),
  /** Vlastní znění (18. 11. 2026) - prázdno vrací výchozí text. */
  predmet: z.string().max(200).optional(),
  nadpis: z.string().max(200).optional(),
  text: z.string().max(4000).optional(),
});

export async function PUT(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Neplatný požadavek.' }, { status: 400 });
  if (!KLICE_OZNAMENI.includes(parsed.data.klic as KlicOznameni)) {
    return NextResponse.json({ error: 'Neznámá zpráva.' }, { status: 400 });
  }

  const kdo = session.user.name || session.user.email || null;
  const klic = parsed.data.klic as KlicOznameni;
  if (parsed.data.zapnuto !== undefined) {
    await nastavZapnuti(klic, parsed.data.zapnuto, kdo);
  }
  const { predmet, nadpis, text } = parsed.data;
  if (predmet !== undefined || nadpis !== undefined || text !== undefined) {
    await nastavZneni(klic, { predmet, nadpis, text }, kdo);
  }
  return NextResponse.json({ ok: true, zapnuti: await nactiZapnuti(), zneni: await nactiZneni() });
}
