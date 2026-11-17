import { NextRequest, NextResponse } from 'next/server';
import { smiSpustitUlohu } from '@/lib/cronGuard';
import { posliVisiciPripominky } from '@/lib/pripominkyVisiServer';

/**
 * BRUNO PŘIPOMENE, CO V PŘIPOMÍNKÁCH VISÍ (zadání 17. 11. 2026).
 *
 * Pondělí ráno, jednou týdně. Sám o sobě nic neodškrtává - viz
 * lib/pripominkyVisiServer.ts.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

async function spust(req: NextRequest) {
  if (!(await smiSpustitUlohu(req))) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }
  try {
    return NextResponse.json({ ok: true, ...(await posliVisiciPripominky()) });
  } catch (err) {
    console.error('Pripomenuti visicich pripominek selhalo:', err);
    return NextResponse.json({ error: 'Rozeslání se nepodařilo.' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return spust(req);
}

export async function POST(req: NextRequest) {
  return spust(req);
}
