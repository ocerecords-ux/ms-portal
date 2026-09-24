import { NextRequest, NextResponse } from 'next/server';
import { smiSpustitUlohu } from '@/lib/cronGuard';
import { zkontrolujNoveStopy } from '@/lib/preposlechPosluchaciServer';

/**
 * Hodinová kontrola nových stop k přeposlechu (zadání 21. 9. 2026: „těm lidem
 * pak nastavíme podle mailu i notifikace, že tam přibyly nové tracky").
 * Pouští to Vercel Cron - viz vercel.json. Ručně ji může spustit admin.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

async function spust(req: NextRequest) {
  if (!(await smiSpustitUlohu(req))) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }
  try {
    const vysledek = await zkontrolujNoveStopy();
    return NextResponse.json({ ok: true, ...vysledek });
  } catch (err) {
    console.error('Cron nove-stopy selhal:', err);
    return NextResponse.json({ error: 'Kontrola nových stop se nepodařila.' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return spust(req);
}

export async function POST(req: NextRequest) {
  return spust(req);
}
