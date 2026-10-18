import { NextRequest, NextResponse } from 'next/server';

import { odpovedChyby } from '@/lib/chybyApi';
import { smiSpustitUlohu } from '@/lib/cronGuard';
import { pripomenChybejiciHudbu } from '@/lib/hudbaPripominkyServer';

/**
 * Ranní kontrola, jestli některé audioknize nechybí hudba tři dny před první
 * frekvencí (zadání 17. 10. 2026). Pouští to Vercel Cron - viz vercel.json;
 * ručně ji smí spustit přihlášené Žůžo-labůžo.
 *
 * Běží ráno, aby se dalo ještě týž den zareagovat - a aby výzva klientovi
 * nepřišla uprostřed noci.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

async function spust(req: NextRequest) {
  if (!(await smiSpustitUlohu(req))) {
    return odpovedChyby('chybaApi.bezOpravneni', 403);
  }
  try {
    return NextResponse.json({ ok: true, ...(await pripomenChybejiciHudbu()) });
  } catch (err) {
    console.error('Připomínka chybějící hudby selhala:', err);
    return odpovedChyby('chybaApi.ulohaNepodarila', 500);
  }
}

export async function GET(req: NextRequest) {
  return spust(req);
}

export async function POST(req: NextRequest) {
  return spust(req);
}
