import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminGuard';
import { pripojUcet } from '@/lib/instagramServer';

/** Návrat z přihlášení u Instagramu (22. 9. 2026) - uloží token a vrátí do Studií. */
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const zpet = new URL('/admin/studia', req.url);
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  const kod = req.nextUrl.searchParams.get('code');
  const state = req.nextUrl.searchParams.get('state');
  if (!kod || !state || state !== req.cookies.get('ig_state')?.value) {
    zpet.searchParams.set('instagram', req.nextUrl.searchParams.get('error_description') || 'Přihlášení se nepovedlo nebo vypršelo.');
    return NextResponse.redirect(zpet);
  }
  const vysledek = await pripojUcet(kod);
  zpet.searchParams.set('instagram', vysledek.ok ? 'ok' : vysledek.chyba);
  const res = NextResponse.redirect(zpet);
  res.cookies.delete('ig_state');
  return res;
}
