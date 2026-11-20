import { NextRequest, NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/adminGuard';
import { odpovedChyby } from '@/lib/chybyApi';
import { prectiPrilohuDokladu } from '@/lib/postaServer';

/**
 * NAČTENÍ ÚDAJŮ Z PŘÍLOHY DOKLADU (zadání 20. 11. 2026: „potřebuju ještě, ať
 * si to načte z faktury ty údaje. Všechno to tam je. Číslo faktury,
 * splatnost…").
 *
 * Čtení běželo jen jednou, v dávce u schránky - když neprošlo, zůstala na
 * dokladu hláška a faktura prázdná. Tohle je stejná práce na tlačítko: účetní
 * si ji vyvolá u konkrétního dokladu, kdykoliv chce.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  if (!session) return odpovedChyby('chybaApi.bezOpravneni', 403);

  const vysledek = await prectiPrilohuDokladu(params.id);
  if (!vysledek.ok) {
    return NextResponse.json({ error: 'cteni', hlaska: vysledek.chyba }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}
