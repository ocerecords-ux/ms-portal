import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { schvalKlientem } from '@/lib/schvaleniKlientem';

/**
 * Schválení spotu klientem (zadání 18. 9. 2026).
 *
 * JEN POST. Kdyby se schvalovalo otevřením odkazu, odklepl by spot první
 * antivir nebo náhled odkazu v chatu - a my bychom fakturovali něco, co si
 * klient ani nepustil.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({ k: z.string().trim().min(10) });

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Neplatná data.' }, { status: 400 });

  const vysledek = await schvalKlientem(parsed.data.k);
  if ('chyba' in vysledek) {
    return NextResponse.json({ error: vysledek.chyba }, { status: vysledek.status });
  }
  return NextResponse.json(vysledek);
}
