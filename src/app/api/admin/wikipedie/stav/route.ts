import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminGuard';
import { jeJazykWiki } from '@/lib/wikipedie';
import { ChybaWiki, stavClanku } from '@/lib/wikipedieServer';
import { odpovedChyby, odpovedChybyS } from '@/lib/chybyApi';

/** Poslední úpravy živého článku (zadání 22. 9. 2026). */
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (!(await requireAdmin())) return odpovedChyby('chybaApi.bezOpravneni', 403);
  const jazyk = req.nextUrl.searchParams.get('jazyk') || 'cs';
  const nazev = (req.nextUrl.searchParams.get('nazev') || '').trim();
  if (!jeJazykWiki(jazyk) || !nazev) return odpovedChyby('chybaApi.wikiChybiNazev', 400);
  try {
    return NextResponse.json(await stavClanku(jazyk, nazev));
  } catch (err) {
    if (err instanceof ChybaWiki) {
      return err.hodnoty ? odpovedChybyS(err.klic, err.hodnoty, 502) : odpovedChyby(err.klic, 502);
    }
    const zprava = err instanceof Error ? err.message : '';
    return zprava
      ? odpovedChybyS('chybaApi.wikiNeodpovedelaZpravaS', { zprava }, 502)
      : odpovedChyby('chybaApi.wikiNeodpovedela', 502);
  }
}
