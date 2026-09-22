import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminGuard';
import { jeJazykWiki } from '@/lib/wikipedie';
import { stavClanku } from '@/lib/wikipedieServer';

/** Poslední úpravy živého článku (zadání 22. 9. 2026). */
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  const jazyk = req.nextUrl.searchParams.get('jazyk') || 'cs';
  const nazev = (req.nextUrl.searchParams.get('nazev') || '').trim();
  if (!jeJazykWiki(jazyk) || !nazev) return NextResponse.json({ error: 'Chybí název článku.' }, { status: 400 });
  try {
    return NextResponse.json(await stavClanku(jazyk, nazev));
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message || 'Wikipedie neodpověděla.' }, { status: 502 });
  }
}
