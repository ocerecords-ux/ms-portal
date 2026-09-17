import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminGuard';
import { sesynchronizujBanku } from '@/lib/bankaServer';
import { bankaNastavena } from '@/lib/gocardless';

/**
 * Pravidelné stahování pohybů z banky (zadání 17. 9. 2026). Pouští to Vercel
 * Cron - viz vercel.json. Kdo sem smí: úloha z Vercelu s CRON_SECRET, nebo
 * přihlášené Žůžo-labůžo ručně. Stejně to má překlopení stavů i měsíční
 * přehled.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

async function smiSem(req: NextRequest): Promise<boolean> {
  const tajemstvi = process.env.CRON_SECRET;
  if (tajemstvi && req.headers.get('authorization') === `Bearer ${tajemstvi}`) return true;
  return Boolean(await requireAdmin());
}

export async function GET(req: NextRequest) {
  if (!(await smiSem(req))) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  // Bez klíčů se nic neděje - ať úloha neplní log chybami, než se nastaví.
  if (!bankaNastavena()) return NextResponse.json({ ok: true, preskoceno: 'GoCardless není nastavený.' });

  try {
    const vysledek = await sesynchronizujBanku();
    return NextResponse.json({ ok: true, ...vysledek });
  } catch (err) {
    console.error('Cron banka selhal:', err);
    return NextResponse.json({ error: 'Stažení pohybů se nepodařilo.' }, { status: 500 });
  }
}
