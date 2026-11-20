import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';

import { authOptions } from '@/lib/auth';
import { odpovedChyby } from '@/lib/chybyApi';
import { nactiKampan, nactiMedia } from '@/lib/emaServer';
import { ulozPredlohuMailu, vlozPredlohuDoMedii } from '@/lib/prHromadnyMail';
import { isInternalRole } from '@/lib/roles';

/**
 * HROMADNÝ MAIL KAMPANĚ (zadání 20. 11. 2026: „chci nastavovat mail hromadně
 * u každé kampaně").
 *
 * Jedno volání uloží předlohu a - když se o to řekne - rovnou ji vloží do
 * médií, která ještě neodešla. Odeslaných se to nikdy nedotkne.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const schema = z.object({
  predmet: z.string().max(300),
  text: z.string().max(8000),
  /** true = po uložení vložit předlohu do médií, která ještě neodešla. */
  vlozitDoMedii: z.boolean().optional(),
  /** true = přepsat jen média, u kterých zatím žádný mail není. */
  jenPrazdna: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !isInternalRole(session.user.role)) {
    return odpovedChyby('chybaApi.bezOpravneni', 403);
  }
  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return odpovedChyby('chybaApi.neplatnaData', 400);

  await ulozPredlohuMailu(id, parsed.data.predmet, parsed.data.text);
  const vlozeno = parsed.data.vlozitDoMedii
    ? await vlozPredlohuDoMedii(id, parsed.data.jenPrazdna ?? false)
    : 0;

  return NextResponse.json({
    vlozeno,
    kampan: await nactiKampan(id),
    media: await nactiMedia(id),
  });
}
