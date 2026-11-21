import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { isInternalRole } from '@/lib/roles';
import { MAX_UKAZKA_BYTES, TYPY_UKAZEK } from '@/lib/prezentaceNabidky';
import { isStorageConfigured, podepsanyUploadUkazky } from '@/lib/storage';
import { odpovedChyby } from '@/lib/chybyApi';

/**
 * ADRESA, NA KTEROU PROHLÍŽEČ POŠLE UKÁZKU (11. 10. 2026). Soubor nejde přes
 * portál, ale rovnou do úložiště - reference s obrazem snadno přeroste strop
 * Vercelu (4,5 MB). Klíč v úložišti určuje výhradně server.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  nazev: z.string().trim().min(1).max(255),
  typ: z.string().trim().max(160),
  velikost: z.number().int().positive().max(MAX_UKAZKA_BYTES),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !isInternalRole(session.user.role)) {
    return odpovedChyby('chybaApi.bezOpravneni', 403);
  }
  if (!isStorageConfigured()) {
    return odpovedChyby('chybaApi.ukazkyBezUloziste', 503);
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    // Věta od `zod` jde první, a když žádná není, jde klíč (vzor z dávky 7s).
    return parsed.error.issues[0]?.message
      ? NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
      : odpovedChyby('chybaApi.neplatnaData', 400);
  }
  if (!TYPY_UKAZEK.includes(parsed.data.typ)) {
    return odpovedChyby('chybaApi.ukazkaTypNebereme', 400);
  }

  const podpis = await podepsanyUploadUkazky(parsed.data.nazev, parsed.data.typ);
  if (!podpis) return odpovedChyby('chybaApi.ukazkaAdresaNepripravena', 500);

  return NextResponse.json(podpis);
}
