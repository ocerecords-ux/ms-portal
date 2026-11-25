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

/**
 * Odpovědi na vlastní otázky chodí jako „klíč otázky → odpověď". Co k otázkám
 * té akce nepatří, zahodí server (viz lib/akce.ts), takže se tady nemusí
 * popisovat každý možný tvar.
 */
const schema = z.object({
  dorazi: z.boolean(),
  odpovedi: z.record(z.unknown()).optional(),
});

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return odpovedChyby('chybaApi.neplatnaData', 400);

  const ulozeno = await zapisOdpoved(params.token, {
    dorazi: parsed.data.dorazi,
    odpovedi: parsed.data.odpovedi ?? {},
  });

  if (!ulozeno) return odpovedChyby('chybaApi.odkazNeplati', 404);
  return NextResponse.json({ ok: true });
}
