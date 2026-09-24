import { NextRequest, NextResponse } from 'next/server';
import { smiSpustitUlohu } from '@/lib/cronGuard';
import { zpracujNavrhyVykazu } from '@/lib/vykazNavrhyServer';

/**
 * NABÍDKA VÝKAZU ZVUKAŘŮM (zadání 20. 9. 2026: „nabídnout by to mělo 5 min.
 * před skončením události"). Pouští to Vercel Cron každých 5 minut - viz
 * vercel.json.
 *
 * KDO SEM SMÍ: úloha z Vercelu (nese `Authorization: Bearer CRON_SECRET`),
 * nebo přihlášené Žůžo-labůžo, když to chce zkusit ručně. Stejně to mají
 * ostatní úlohy.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function spust(req: NextRequest) {
  if (!(await smiSpustitUlohu(req))) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }
  try {
    const vysledek = await zpracujNavrhyVykazu();
    return NextResponse.json({ ok: true, ...vysledek });
  } catch (err) {
    console.error('Cron vykazy-navrhy selhal:', err);
    return NextResponse.json({ error: 'Nabídka výkazů se nepodařila.' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return spust(req);
}

export async function POST(req: NextRequest) {
  return spust(req);
}
