import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/adminGuard';
import { prisma } from '@/lib/db';
import { odesliNaWiki } from '@/lib/wikipedieServer';

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
  if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Neplatná data.' }, { status: 400 });
  }

  const clanek = await prisma.wikiClanek.findUnique({ where: { userId: session.user.id } });
  if (!clanek) return NextResponse.json({ error: 'Nejdřív koncept uložte.' }, { status: 400 });
  if (!clanek.token) {
    return NextResponse.json({ error: 'Chybí přístupový token - vyplňte ho v Odesílání na Wikipedii.' }, { status: 400 });
  }

  const vysledek = await odesliNaWiki({
    jazyk: clanek.jazyk,
    titul: parsed.data.cil,
    wikitext: clanek.wikitext,
    shrnuti: parsed.data.shrnuti || 'Úprava z MS Portalu',
    token: clanek.token,
  });
  if (!vysledek.ok) return NextResponse.json({ error: vysledek.chyba }, { status: 502 });

  await prisma.wikiClanek
    .update({ where: { id: clanek.id }, data: { cilStranka: parsed.data.cil } })
    .catch(() => undefined);
  return NextResponse.json({ ok: true, url: vysledek.url, revid: vysledek.revid });
}
