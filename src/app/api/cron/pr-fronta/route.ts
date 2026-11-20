import { NextRequest, NextResponse } from 'next/server';

import { smiSpustitUlohu } from '@/lib/cronGuard';
import { odesliZFronty } from '@/lib/prOdeslaniServer';

/**
 * FRONTA MAILŮ OD EMY (zadání 20. 11. 2026: „aby se z Emy nestal spam, když
 * bude rozesílat hromadné maily v jeden den").
 *
 * Každých pět minut vezme nejvýš jeden mail, kterému dozrál čas. Rozestupy,
 * pracovní dobu a denní strop hlídá lib/prTempo.ts - tahle úloha jen pouští
 * frontu.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function spust(req: NextRequest) {
  if (!(await smiSpustitUlohu(req))) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }
  try {
    return NextResponse.json({ ok: true, ...(await odesliZFronty()) });
  } catch (err) {
    console.error('Cron pr-fronta selhal:', err);
    return NextResponse.json({ error: 'Frontu se nepodařilo pustit.' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return spust(req);
}

export async function POST(req: NextRequest) {
  return spust(req);
}
