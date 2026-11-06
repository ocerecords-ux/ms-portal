import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/adminGuard';
import { smiDoBanky } from '@/lib/bankaPristup';
import { rozhodniOPohybu } from '@/lib/bankaServer';
import { odpovedChyby } from '@/lib/chybyApi';

/** Ruční rozhodnutí o jednom pohybu: spárovat, ignorovat, odpárovat. */
export const dynamic = 'force-dynamic';

const schema = z.object({
  akce: z.enum(['sparovat', 'ignorovat', 'odparovat']),
  invoiceId: z.string().trim().min(1).nullable().optional(),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  if (!session) return odpovedChyby('chybaApi.bezOpravneni', 403);
  // Do banky smi jen ten, kdo to ma dovolene u uctu (17. 9. 2026).
  if (!(await smiDoBanky())) return odpovedChyby('chybaApi.bezOpravneni', 403);

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return odpovedChyby('chybaApi.neplatnaData', 400);

  const vysledek = await rozhodniOPohybu(params.id, parsed.data.akce, parsed.data.invoiceId ?? null);
  // Knihovna vraci KLIC, ne hotovou vetu - obrazovka si ji prelozi sama
  // (davka 7w, vzor z 7o).
  if ('klic' in vysledek) return odpovedChyby(vysledek.klic, 409);
  return NextResponse.json(vysledek);
}
