import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminGuard';
import { smiSpustitUlohu } from '@/lib/cronGuard';
import { posliRanniPrehledy } from '@/lib/ranniPrehledServer';

/**
 * RANNÍ PŘEHLED OD BRUNA (zadání 23. 9. 2026) - v sedm ráno pražského času.
 * Vercel Cron běží v UTC, takže se úloha pouští v 5:00 i v 6:00 UTC a sama
 * si pozná, kdy je v Praze sedmá (léto/zima). Viz lib/ranniPrehledServer.ts.
 *
 * KDO SEM SMÍ: úloha z Vercelu (`Authorization: Bearer CRON_SECRET`), nebo
 * přihlášené Žůžo-labůžo ručně. Ruční spuštění (?vynutit=1) pošle přehled
 * hned, ať se dá vyzkoušet mimo sedmou.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

async function spust(req: NextRequest) {
  if (!(await smiSpustitUlohu(req))) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }
  try {
    // Vynutit smí jen člověk z portálu, ne úloha - jinak by přehled chodil
    // každou hodinu.
    const vynutit = req.nextUrl.searchParams.get('vynutit') === '1' && Boolean(await requireAdmin());
    const vysledek = await posliRanniPrehledy({ vynutit });
    return NextResponse.json({ ok: true, ...vysledek });
  } catch (err) {
    console.error('Ranni prehled selhal:', err);
    return NextResponse.json({ error: 'Ranní přehled se nepodařilo poslat.' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return spust(req);
}

export async function POST(req: NextRequest) {
  return spust(req);
}
