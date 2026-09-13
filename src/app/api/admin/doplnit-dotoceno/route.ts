import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/adminGuard';
import { doplnDotocenoZpetne } from '@/lib/dotoceniZpetneServer';

/**
 * Doplnění „Dotočeno" zpětně, bez jediné odeslané zprávy (zadání
 * 13. 9. 2026). Podrobně, včetně toho proč to nevede přes běžný endpoint,
 * v lib/dotoceniZpetneServer.ts.
 *
 * JEN ŽŮŽO-LABŮŽO. Běžné tlačítko „Dotočeno" smí i produkce, tohle ne:
 * je to zásah do historie dat, ne denní provoz.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  projekty: z
    .array(
      z.object({
        caflouProjectId: z.string().trim().min(1),
        userIds: z.array(z.string().trim().min(1)).min(1),
      }),
    )
    .min(1)
    // Strop proti odeslani celeho seznamu omylem - je to jednorazova oprava
    // historie, ne davkovy import.
    .max(200),
});

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Neplatná data.' }, { status: 400 });
  }

  const puvodce = { id: session.user.id, jmeno: session.user.name || session.user.email || null };

  // Postupne, ne paralelne: prekloneni stavu cte, kolik hercu uz fajfku ma,
  // a soubezne zapisy do tehoz projektu by si do toho vzajemne mluvily.
  const vysledky = [];
  for (const p of parsed.data.projekty) {
    vysledky.push(await doplnDotocenoZpetne(p.caflouProjectId, p.userIds, puvodce));
  }

  return NextResponse.json({
    hotovo: true,
    hercu: vysledky.reduce((n, v) => n + v.pridano.length, 0),
    stavu: vysledky.filter((v) => v.stav).length,
    vysledky,
  });
}
