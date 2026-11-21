import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/adminGuard';
import { JAZYKY_WIKI } from '@/lib/wikipedie';
import { ChybaWiki, vykresliNahled } from '@/lib/wikipedieServer';
import { odpovedChyby, odpovedChybyS } from '@/lib/chybyApi';

/** Náhled konceptu tak, jak by vypadal na Wikipedii (zadání 22. 9. 2026). */
export const dynamic = 'force-dynamic';

const schema = z.object({
  jazyk: z.enum(JAZYKY_WIKI),
  nazev: z.string().trim().max(200),
  wikitext: z.string().max(300_000),
});

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) return odpovedChyby('chybaApi.bezOpravneni', 403);
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return odpovedChyby('chybaApi.neplatnaData', 400);
  try {
    const html = await vykresliNahled(parsed.data.jazyk, parsed.data.nazev, parsed.data.wikitext);
    return NextResponse.json({ html });
  } catch (err) {
    // Chyba z knihovny už klíč nese; ostatní (síť, cizí služba) jdou se svou
    // zprávou do značky, a bez ní prostým klíčem (vzor z dávky 7y).
    if (err instanceof ChybaWiki) {
      return err.hodnoty ? odpovedChybyS(err.klic, err.hodnoty, 502) : odpovedChyby(err.klic, 502);
    }
    const zprava = err instanceof Error ? err.message : '';
    return zprava
      ? odpovedChybyS('chybaApi.wikiNahledNepodarilS', { zprava }, 502)
      : odpovedChyby('chybaApi.wikiNahledNepodaril', 502);
  }
}
