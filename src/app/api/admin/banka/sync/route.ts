import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminGuard';
import { odpovedChyby } from '@/lib/chybyApi';
import { smiDoBanky } from '@/lib/bankaPristup';
import { sesynchronizujBanku } from '@/lib/bankaServer';
import { bankaNastavena } from '@/lib/gocardless';

/** Stažení pohybů na kliknutí - když se čekat na noční úlohu nechce. */
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST() {
  const session = await requireAdmin();
  if (!session) return odpovedChyby('chybaApi.bezOpravneni', 403);
  // Do banky smi jen ten, kdo to ma dovolene u uctu (17. 9. 2026).
  if (!(await smiDoBanky())) return odpovedChyby('chybaApi.bezOpravneni', 403);
  if (!bankaNastavena()) return odpovedChyby('chybaApi.bankaBezKlicu', 503);

  try {
    const vysledek = await sesynchronizujBanku();
    return NextResponse.json(vysledek);
  } catch (err) {
    console.error('Stažení pohybů selhalo:', err);
    return odpovedChyby('chybaApi.stazeniPohybuNepodarilo', 502);
  }
}
