import { NextRequest, NextResponse } from 'next/server';
import { smiSpustitUlohu } from '@/lib/cronGuard';
import { posliUpominky } from '@/lib/upominkyServer';

/**
 * Denní rozeslání upomínek k fakturám po splatnosti (zadání 25. 9. 2026).
 * Pouští to Vercel Cron - viz vercel.json; ručně ji smí spustit Žůžo-labůžo.
 *
 * Když jsou upomínky vypnuté, úloha nic nepošle a jen to řekne.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

async function spust(req: NextRequest) {
  if (!(await smiSpustitUlohu(req))) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }
  try {
    return NextResponse.json({ ok: true, ...(await posliUpominky()) });
  } catch (err) {
    console.error('Rozeslani upominek selhalo:', err);
    return NextResponse.json({ error: 'Rozeslání se nepodařilo.' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return spust(req);
}

export async function POST(req: NextRequest) {
  return spust(req);
}
