import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminGuard';
import { zkontrolujClanky } from '@/lib/wikipedieServer';

/**
 * Hlídání článků na Wikipedii každou hodinu (zadání 22. 9. 2026) - viz
 * lib/wikipedieServer.ts a vercel.json. Ručně ji může spustit admin.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

async function smiSem(req: NextRequest): Promise<boolean> {
  const tajemstvi = process.env.CRON_SECRET;
  if (tajemstvi && req.headers.get('authorization') === `Bearer ${tajemstvi}`) return true;
  return Boolean(await requireAdmin());
}

async function spust(req: NextRequest) {
  if (!(await smiSem(req))) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  try {
    return NextResponse.json({ ok: true, ...(await zkontrolujClanky()) });
  } catch (err) {
    console.error('Cron wikipedie selhal:', err);
    return NextResponse.json({ error: 'Kontrola článků se nepodařila.' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return spust(req);
}

export async function POST(req: NextRequest) {
  return spust(req);
}
