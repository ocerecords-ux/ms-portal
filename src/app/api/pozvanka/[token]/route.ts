import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { zapisOdpoved } from '@/lib/akceServer';
import { odpovedChyby } from '@/lib/chybyApi';

/**
 * ODPOVĚĎ NA POZVÁNKU (zadání 25. 11. 2026) - OTEVŘENÝ ODKAZ, BEZ PŘIHLÁŠENÍ.
 *
 * Pozvánka chodí i klientům a hercům, kteří portál běžně neotevírají; nutit
 * je kvůli jedné otázce k přihlášení by znamenalo, že nikdo neodpoví. Token
 * je náhodný a platí jen pro jednoho člověka - víc než jeho vlastní odpověď
 * z něj nikdo nevyčte.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  dorazi: z.boolean(),
  ubytovani: z.boolean(),
  piti: z.array(z.string().trim().max(40)).max(20),
  pitiText: z.string().trim().max(500).nullable().optional(),
  poznamka: z.string().trim().max(2000).nullable().optional(),
});

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return odpovedChyby('chybaApi.neplatnaData', 400);

  const ulozeno = await zapisOdpoved(params.token, {
    dorazi: parsed.data.dorazi,
    ubytovani: parsed.data.ubytovani,
    piti: parsed.data.piti,
    pitiText: parsed.data.pitiText ?? null,
    poznamka: parsed.data.poznamka ?? null,
  });

  if (!ulozeno) return odpovedChyby('chybaApi.odkazNeplati', 404);
  return NextResponse.json({ ok: true });
}
