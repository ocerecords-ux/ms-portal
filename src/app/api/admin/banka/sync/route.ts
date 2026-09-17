import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminGuard';
import { sesynchronizujBanku } from '@/lib/bankaServer';
import { bankaNastavena } from '@/lib/gocardless';

/** Stažení pohybů na kliknutí - když se čekat na noční úlohu nechce. */
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  if (!bankaNastavena()) return NextResponse.json({ error: 'Klíče GoCardless nejsou nastavené.' }, { status: 503 });

  try {
    const vysledek = await sesynchronizujBanku();
    return NextResponse.json(vysledek);
  } catch (err) {
    console.error('Stažení pohybů selhalo:', err);
    return NextResponse.json({ error: 'Stažení pohybů se nepodařilo.' }, { status: 502 });
  }
}
