import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { odpovedChyby } from '@/lib/chybyApi';
import { smiSchvalovatPribehy } from '@/lib/pribehyServer';
import { MAX_HUDBA_BYTES, TYPY_HUDBY } from '@/lib/hudba';
import { isStorageConfigured, podepsanyUploadHudby } from '@/lib/storage';

/**
 * ADRESA, NA KTEROU PROHLÍŽEČ POŠLE SKLADBU (8. 10. 2026). Stejný důvod
 * jako u příběhu: soubor nejde přes portál, ale rovnou do úložiště.
 * Klíč určuje výhradně server.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  nazev: z.string().trim().min(1).max(255),
  typ: z.string().trim().max(160),
  velikost: z.number().int().positive().max(MAX_HUDBA_BYTES),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return odpovedChyby('chybaApi.bezOpravneni', 403);
  if (!(await smiSchvalovatPribehy({ id: session.user.id, role: session.user.role }))) {
    return odpovedChyby('chybaApi.knihovnuPlniProdukce', 403);
  }
  if (!isStorageConfigured()) {
    return odpovedChyby('chybaApi.hudbaBezUloziste', 503);
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Neplatná data.' }, { status: 400 });
  }
  if (!TYPY_HUDBY.includes(parsed.data.typ)) {
    return odpovedChyby('chybaApi.spatnyTypHudby', 400);
  }

  const podpis = await podepsanyUploadHudby(parsed.data.nazev, parsed.data.typ);
  if (!podpis) return odpovedChyby('chybaApi.uloznisteNedostupne', 503);
  return NextResponse.json(podpis);
}
