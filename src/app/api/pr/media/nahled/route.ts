import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';

import { authOptions } from '@/lib/auth';
import { odpovedChyby } from '@/lib/chybyApi';
import { teloMailuHtml } from '@/lib/prPodpis';
import { isInternalRole } from '@/lib/roles';

/**
 * NÁHLED MAILU (zadání 20. 11. 2026: „dej mi někde možnost, abych mohl Emě
 * editovat ten mail, co posílá").
 *
 * Text se posílá z obrazovky, ne z databáze - ať je v náhledu vidět i to, co
 * se zrovna přepsalo a ještě se neuložilo. Podpis se skládá stejnou funkcí,
 * jakou pak mail doopravdy odejde, takže náhled nemůže ukázat něco jiného,
 * než co přijde adresátovi.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({ text: z.string() });

const ADRESA_EMY = () => process.env.PR_ODPOVED?.trim() || 'pr@mediaspace.cz';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !isInternalRole(session.user.role)) {
    return odpovedChyby('chybaApi.bezOpravneni', 403);
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return odpovedChyby('chybaApi.neplatnaData', 400);

  return NextResponse.json({
    html: teloMailuHtml(parsed.data.text, ADRESA_EMY()),
    adresa: ADRESA_EMY(),
  });
}
