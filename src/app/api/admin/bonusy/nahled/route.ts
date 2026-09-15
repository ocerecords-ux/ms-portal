import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminGuard';
import { buildBonusHtml } from '@/lib/email';
import { zakladPortalu } from '@/lib/preposlechOdkaz';

/**
 * Náhled mailu o schváleném bonusu (zadání 15. 9. 2026: „ukaž mi pak i jak
 * bude vypadat mail"). Nic neodesílá - jen ukázková data, ať je vidět, co
 * zvukaři dorazí.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

  const html = buildBonusHtml({
    to: '',
    jmeno: 'Richard',
    projekt: 'ANNIE BOT',
    castka: '1 040 Kč',
    podilProcent: 93,
    poznamka: null,
    schvalil: 'Petr Dratva',
    odkaz: `${zakladPortalu()}/vykazy?zalozka=bonusy`,
  });

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
