import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';
import { CASTI_FAKTURY } from '@/lib/fakturaCast';
import { odpovedChyby } from '@/lib/chybyApi';

/**
 * INTERNÍ OZNAČENÍ ČÁSTI ZAKÁZKY (zadání 29. 9. 2026).
 *
 * VLASTNÍ ENDPOINT, a ne pole v úpravě faktury, kvůli jediné věci: úprava
 * faktury odmítá sáhnout na uhrazený doklad, a to je správně - čísla, částky
 * ani datumy se po zaplacení měnit nemají. Tahle značka ale na dokladu není,
 * netiskne se a nikam neodchází, takže ji musí jít doplnit i zpětně k fakturám,
 * které jsou dávno zaplacené. Jinak by se stará zakázka označit nedala.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  /** null = značku sundat; zakázka není na části. */
  cast: z.enum(CASTI_FAKTURY).nullable(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  if (!session) return odpovedChyby('chybaApi.bezOpravneni', 403);

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return odpovedChyby('chybaApi.neplatnaHodnota', 400);

  const faktura = await prisma.invoice.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!faktura) return odpovedChyby('chybaApi.fakturaNenalezena', 404);

  const ulozena = await prisma.invoice.update({
    where: { id: params.id },
    data: { interniCast: parsed.data.cast },
    select: { interniCast: true },
  });
  return NextResponse.json({ ulozeno: true, cast: ulozena.interniCast });
}
