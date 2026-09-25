import { NextRequest, NextResponse } from 'next/server';
import { smiSpustitUlohu } from '@/lib/cronGuard';
import { posliPripominkyRezervaci } from '@/lib/bookingServer';

/**
 * PŘIPOMÍNKA REZERVACE DEN PŘEDEM (zadání 25. 9. 2026: „pod kliknutím na jméno
 * by měl jít nastavit osobní profil a různé notifikace, změny termínů a pod").
 *
 * Běží odpoledne - na zítřek už se dá zareagovat, na dnešek ráno většinou ne.
 * Komu to chodí, rozhoduje přepínač na jeho účtu.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

async function spust(req: NextRequest) {
  if (!(await smiSpustitUlohu(req))) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }
  try {
    return NextResponse.json({ ok: true, ...(await posliPripominkyRezervaci()) });
  } catch (err) {
    console.error('Pripominky rezervaci studia selhaly:', err);
    return NextResponse.json({ error: 'Rozeslání se nepodařilo.' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return spust(req);
}

export async function POST(req: NextRequest) {
  return spust(req);
}
