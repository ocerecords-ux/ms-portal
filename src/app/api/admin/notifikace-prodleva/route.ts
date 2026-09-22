import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/adminGuard';
import { MAX_PRODLEVA_S, nactiProdlevu, nastavProdlevu } from '@/lib/prodlevaNotifikaciServer';

/** Prodleva zpráv klientovi po změně stavu (zadání 22. 9. 2026) - pro všechny firmy. */
export const dynamic = 'force-dynamic';

const schema = z.object({ sekund: z.number().int().min(0).max(MAX_PRODLEVA_S) });

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  return NextResponse.json({ sekund: await nactiProdlevu() });
}

export async function PUT(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: `Prodleva musí být celé číslo 0–${MAX_PRODLEVA_S} s.` }, { status: 400 });
  }
  const sekund = await nastavProdlevu(parsed.data.sekund, session.user.name || session.user.email || null);
  return NextResponse.json({ ok: true, sekund });
}
