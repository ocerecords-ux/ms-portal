import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { schvalKlientem, schvalPrihlasenym } from '@/lib/schvaleniKlientem';

/**
 * Schválení spotu klientem (zadání 18. 9. 2026).
 *
 * JEN POST. Kdyby se schvalovalo otevřením odkazu, odklepl by spot první
 * antivir nebo náhled odkazu v chatu - a my bychom fakturovali něco, co si
 * klient ani nepustil.
 */
export const dynamic = 'force-dynamic';

/**
 * Dvě cesty dovnitř (upřesnění 18. 9. 2026): `k` je token z mailu, `projekt`
 * je ID zakázky z klientského portálu. U tokenu rozhoduje odkaz, u projektu
 * přihlášení - viz lib/schvaleniKlientem.ts.
 */
const schema = z.object({
  k: z.string().trim().min(10).optional(),
  projekt: z.string().trim().min(1).optional(),
});

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Neplatná data.' }, { status: 400 });

  const { k, projekt } = parsed.data;
  if (!k && !projekt) return NextResponse.json({ error: 'Chybí odkaz.' }, { status: 400 });

  const vysledek = k ? await schvalKlientem(k) : await schvalPrihlasenym(projekt as string);
  if ('chyba' in vysledek) {
    return NextResponse.json({ error: vysledek.chyba }, { status: vysledek.status });
  }
  return NextResponse.json(vysledek);
}
