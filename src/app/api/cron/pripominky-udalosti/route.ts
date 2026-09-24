import { NextRequest, NextResponse } from 'next/server';
import { smiSpustitUlohu } from '@/lib/cronGuard';
import { posliPripominkyUdalosti } from '@/lib/pripominkyUdalostiServer';

/**
 * PŘIPOMÍNKA 15 MINUT PŘED UDÁLOSTÍ (zadání 23. 9. 2026). Úloha běží každých
 * pět minut a bere okno 10-20 minut dopředu - viz lib/pripominkyUdalostiServer.ts.
 *
 * KDO SEM SMÍ: úloha z Vercelu (`Authorization: Bearer CRON_SECRET`), nebo
 * přihlášené Žůžo-labůžo ručně (na vyzkoušení).
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

async function spust(req: NextRequest) {
  if (!(await smiSpustitUlohu(req))) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }
  try {
    const vysledek = await posliPripominkyUdalosti();
    return NextResponse.json({ ok: true, ...vysledek });
  } catch (err) {
    console.error('Pripominky udalosti selhaly:', err);
    return NextResponse.json({ error: 'Připomínky se nepodařilo poslat.' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return spust(req);
}

export async function POST(req: NextRequest) {
  return spust(req);
}
