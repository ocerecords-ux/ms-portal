import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/adminGuard';
import { userLabel } from '@/lib/chatServer';
import { fakturyPoSplatnosti, nactiNastaveniUpominek, ulozNastaveniUpominek } from '@/lib/upominkyServer';

/**
 * NASTAVENÍ UPOMÍNEK (zadání 25. 9. 2026: „potřebuji nastavit upomínky na
 * faktury po splatnosti. Chci je někde editovat, včetně náhledu emailu").
 *
 * GET vrací nastavení i seznam faktur, které jsou zrovna po splatnosti -
 * stránka tak na jedno načtení ukáže, co se komu chystá poslat.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  zapnuto: z.boolean(),
  /** Po kolika dnech po splatnosti jde která upomínka. */
  dny: z.array(z.number().int().min(0).max(365)).min(1).max(6),
  predmet: z.string().trim().max(200),
  text: z.string().trim().max(4000),
  kopie: z.array(z.string().trim().max(200)).max(10),
});

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

  const [nastaveni, faktury] = await Promise.all([nactiNastaveniUpominek(), fakturyPoSplatnosti()]);
  return NextResponse.json({ nastaveni, faktury });
}

export async function PUT(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Neplatná data.' }, { status: 400 });
  }

  try {
    await ulozNastaveniUpominek(parsed.data, userLabel({ name: session.user?.name ?? null, email: session.user?.email ?? '' }));
    return NextResponse.json({ ok: true, nastaveni: await nactiNastaveniUpominek() });
  } catch (err) {
    console.error('PUT /api/admin/upominky selhalo:', err);
    const message = err instanceof Error ? err.message : 'Neznámá chyba.';
    return NextResponse.json({ error: `Uložení se nezdařilo (${message}).` }, { status: 500 });
  }
}
