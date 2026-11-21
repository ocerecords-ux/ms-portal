import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/adminGuard';
import { prisma } from '@/lib/db';
import { odesliNaWiki } from '@/lib/wikipedieServer';
import { odpovedChyby, odpovedChybyS } from '@/lib/chybyApi';

/**
 * Odeslání konceptu na Wikipedii pod účtem uživatele (zadání 22. 9. 2026:
 * „chci to rovnou odesílat z portálu"). Posílá se to, co je v konceptu
 * uložené - ne to, co je zrovna rozepsané v prohlížeči; formulář proto
 * nejdřív ukládá.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  cil: z.string().trim().min(1, 'Vyplňte, kam se má text uložit.').max(255),
  shrnuti: z.string().trim().max(300).optional(),
});

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return odpovedChyby('chybaApi.bezOpravneni', 403);

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    // Hlášky ze `zod` zůstávají česky (rozhodnutí z dávky 7s); klíč dostává
    // jen záložní věta, která chodí, když `zod` žádnou svou nedal.
    const zprava = parsed.error.issues[0]?.message;
    return zprava
      ? NextResponse.json({ error: zprava }, { status: 400 })
      : odpovedChyby('chybaApi.neplatnaData', 400);
  }

  const clanek = await prisma.wikiClanek.findUnique({ where: { userId: session.user.id } });
  if (!clanek) return odpovedChyby('chybaApi.wikiNejdrivUlozte', 400);
  if (!clanek.token) return odpovedChyby('chybaApi.wikiChybiToken', 400);

  const vysledek = await odesliNaWiki({
    jazyk: clanek.jazyk,
    titul: parsed.data.cil,
    wikitext: clanek.wikitext,
    shrnuti: parsed.data.shrnuti || 'Úprava z MS Portalu',
    token: clanek.token,
  });
  if (!vysledek.ok) {
    return vysledek.hodnoty
      ? odpovedChybyS(vysledek.klic, vysledek.hodnoty, 502)
      : odpovedChyby(vysledek.klic, 502);
  }

  await prisma.wikiClanek
    .update({ where: { id: clanek.id }, data: { cilStranka: parsed.data.cil } })
    .catch(() => undefined);
  return NextResponse.json({ ok: true, url: vysledek.url, revid: vysledek.revid });
}
