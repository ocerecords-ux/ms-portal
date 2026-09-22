import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminGuard';
import { zalohujTextyRE } from '@/lib/zalohaTextuServer';

/**
 * Záloha textů _RE každou čtvrthodinu (zadání 22. 9. 2026) - viz
 * lib/zalohaTextuServer.ts a vercel.json. Ručně ji může spustit admin.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

async function smiSem(req: NextRequest): Promise<boolean> {
  const tajemstvi = process.env.CRON_SECRET;
  if (tajemstvi && req.headers.get('authorization') === `Bearer ${tajemstvi}`) return true;
  return Boolean(await requireAdmin());
}

async function spust(req: NextRequest) {
  if (!(await smiSem(req))) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }
  try {
    const vysledek = await zalohujTextyRE();
    return NextResponse.json({ ok: true, ...vysledek });
  } catch (err) {
    console.error('Cron zaloha-textu selhal:', err);
    return NextResponse.json({ error: 'Záloha textů se nepodařila.' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return spust(req);
}

export async function POST(req: NextRequest) {
  return spust(req);
}
