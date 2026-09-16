import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ulozVyplneni } from '@/lib/pozvankaUdaju';

/**
 * ODESLÁNÍ VYPLNĚNÝCH ÚDAJŮ (zadání 16. 9. 2026).
 *
 * Veřejná routa — klíčem je token z odkazu, nikdo se nepřihlašuje. Proto se
 * tady nic nerozhoduje: co se smí zapsat a co počká na odkliknutí, řeší
 * lib/pozvankaUdaju.ts na jednom místě.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  udaje: z.record(z.union([z.string(), z.boolean(), z.array(z.string()), z.null()])),
  vzkaz: z.string().max(2000).optional().nullable(),
});

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Formulář se nepodařilo přečíst.' }, { status: 400 });
  }

  const vysledek = await ulozVyplneni(params.token, parsed.data.udaje, parsed.data.vzkaz ?? null);
  if (!vysledek.ok) {
    return NextResponse.json({ error: vysledek.chyba }, { status: 400 });
  }
  return NextResponse.json({ ok: true, hotovo: vysledek.hotovo });
}
