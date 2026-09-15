import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminGuard';
import { minulyMesic, rozesliMesicniPrehledy } from '@/lib/mesicniPrehledServer';

/**
 * Měsíční rozeslání přehledu výkazů (zadání 15. 9. 2026). Pouští to Vercel
 * Cron šestého v měsíci — viz vercel.json.
 *
 * KDO SEM SMÍ: úloha z Vercelu (nese `Authorization: Bearer CRON_SECRET`),
 * nebo přihlášené Žůžo-labůžo, když chce rozeslání spustit ručně. Když
 * CRON_SECRET nastavený není, pustí se jen ruční spuštění — otevřená adresa,
 * která rozesílá maily, je zbytečná díra.
 *
 * `?mesic=2026-08` dovolí doslat přehled za starší měsíc; bez něj se bere
 * měsíc minulý. Co už jednou odešlo, se neopakuje.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function smiSem(req: NextRequest): Promise<boolean> {
  const tajemstvi = process.env.CRON_SECRET;
  if (tajemstvi && req.headers.get('authorization') === `Bearer ${tajemstvi}`) return true;
  return Boolean(await requireAdmin());
}

async function spust(req: NextRequest) {
  if (!(await smiSem(req))) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }

  const zadany = req.nextUrl.searchParams.get('mesic');
  const mesic = zadany && /^\d{4}-\d{2}$/.test(zadany) ? zadany : minulyMesic();

  try {
    const vysledek = await rozesliMesicniPrehledy(mesic);
    return NextResponse.json({ ok: true, ...vysledek });
  } catch (err) {
    console.error('Rozeslání měsíčních přehledů selhalo:', err);
    return NextResponse.json({ error: 'Rozeslání se nepodařilo.' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return spust(req);
}

export async function POST(req: NextRequest) {
  return spust(req);
}
