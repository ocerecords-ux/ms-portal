import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/adminGuard';
import { KLICE_OZNAMENI, type KlicOznameni } from '@/lib/oznameni';
import { nactiZapnuti, nastavZapnuti } from '@/lib/oznameniServer';

/** Zapnutí a vypnutí automatických zpráv portálu (zadání 15. 9. 2026). */
export const dynamic = 'force-dynamic';

const schema = z.object({
  klic: z.string().trim().min(1),
  zapnuto: z.boolean(),
});

export async function PUT(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Neplatný požadavek.' }, { status: 400 });
  if (!KLICE_OZNAMENI.includes(parsed.data.klic as KlicOznameni)) {
    return NextResponse.json({ error: 'Neznámá zpráva.' }, { status: 400 });
  }

  await nastavZapnuti(
    parsed.data.klic as KlicOznameni,
    parsed.data.zapnuto,
    session.user.name || session.user.email || null,
  );
  return NextResponse.json({ ok: true, zapnuti: await nactiZapnuti() });
}
