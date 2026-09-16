import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminGuard';
import { preklopCekameNaOpravy } from '@/lib/cekameNaOpravyServer';

/**
 * Denní překlopení „Dokončeno - ke schválení" → „Čekáme na opravy" po sedmi
 * dnech (zadání 10. 9. 2026, spuštěné 16. 9. 2026). Pouští to Vercel Cron -
 * viz vercel.json.
 *
 * KDO SEM SMÍ: úloha z Vercelu (nese `Authorization: Bearer CRON_SECRET`),
 * nebo přihlášené Žůžo-labůžo, když to chce pustit ručně. Bez CRON_SECRET jen
 * ruční spuštění - otevřená adresa, která přehazuje stavy a posílá klientům
 * zprávy, je zbytečná díra. Stejně to má měsíční přehled výkazů.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

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
    const vysledek = await preklopCekameNaOpravy();
    return NextResponse.json({ ok: true, ...vysledek });
  } catch (err) {
    console.error('Preklopeni na "Cekame na opravy" selhalo:', err);
    return NextResponse.json({ error: 'Překlopení se nepodařilo.' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return spust(req);
}

export async function POST(req: NextRequest) {
  return spust(req);
}
