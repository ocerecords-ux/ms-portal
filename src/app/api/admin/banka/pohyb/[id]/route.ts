import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/adminGuard';
import { rozhodniOPohybu } from '@/lib/bankaServer';

/** Ruční rozhodnutí o jednom pohybu: spárovat, ignorovat, odpárovat. */
export const dynamic = 'force-dynamic';

const schema = z.object({
  akce: z.enum(['sparovat', 'ignorovat', 'odparovat']),
  invoiceId: z.string().trim().min(1).nullable().optional(),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Neplatná data.' }, { status: 400 });

  const vysledek = await rozhodniOPohybu(params.id, parsed.data.akce, parsed.data.invoiceId ?? null);
  if ('error' in vysledek) return NextResponse.json(vysledek, { status: 409 });
  return NextResponse.json(vysledek);
}
