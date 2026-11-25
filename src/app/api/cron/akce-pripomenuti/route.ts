import { NextRequest, NextResponse } from 'next/server';

import { odpovedChyby } from '@/lib/chybyApi';
import { smiSpustitUlohu } from '@/lib/cronGuard';
import { pripomenAkce } from '@/lib/akceServer';

/**
 * PŘIPOMÍNKA FIREMNÍ AKCE DEN PŘEDEM (zadání 25. 11. 2026: „připomínací mail
 * den dopředu, když člověk potvrdí účast… a rovnou odkaz s mapkou").
 *
 * Pouští to Vercel Cron (viz vercel.json), ručně ji smí spustit přihlášené
 * Žůžo-labůžo. Běží ráno: připomínka na večírek má přijít den předem ráno,
 * ne v noci a ne hodinu před odchodem.
 *
 * Komu a podle čeho se vybírá, je v lib/akceServer.ts - tady je jen vrátnice.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

async function spust(req: NextRequest) {
  if (!(await smiSpustitUlohu(req))) {
    return odpovedChyby('chybaApi.bezOpravneni', 403);
  }
  try {
    return NextResponse.json({ ok: true, ...(await pripomenAkce()) });
  } catch (err) {
    console.error('Připomínka firemní akce selhala:', err);
    return odpovedChyby('chybaApi.ulohaNepodarila', 500);
  }
}

export async function GET(req: NextRequest) {
  return spust(req);
}

export async function POST(req: NextRequest) {
  return spust(req);
}
