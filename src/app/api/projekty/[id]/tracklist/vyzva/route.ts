import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { odpovedChyby } from '@/lib/chybyApi';
import { isInternalRole } from '@/lib/roles';
import { posliVyzvu, stavVyzvy } from '@/lib/vyzvaHudbaServer';

/**
 * POSLAT KLIENTOVI VÝZVU JEN NA TRACKLIST (zadání 19. 11. 2026: „v tom ručním
 * módu bych to udělal zvlášť na hudbu a zvlášť na tracklist").
 *
 * Automatická výzva tři dny před první frekvencí jde na obojí naráz, ať
 * klienta neobtěžujeme dvakrát. Tohle je tlačítko ze záložky Tracklist pro
 * případ, že se tracklist potřebuje dřív nebo že na něj došlo samostatně.
 *
 * Odkaz je tentýž jako u hudby - jedna stránka, na které je obojí.
 */
export const dynamic = 'force-dynamic';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isInternalRole(session.user.role)) {
    return odpovedChyby('chybaApi.bezOpravneni', 403);
  }

  const { id } = await params;
  const vysledek = await posliVyzvu(id, true, 'tracklist');
  if (!vysledek.ok) {
    // Důvod chodí i klíčem - obrazovka si ho přeloží (dávka 7o).
    return NextResponse.json({ error: vysledek.duvod, klic: vysledek.duvodKlic }, { status: 502 });
  }

  return NextResponse.json({ vyzva: await stavVyzvy(id) });
}
