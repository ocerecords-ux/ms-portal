import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { requireAdmin } from '@/lib/adminGuard';
import { instagramNastaven, odkazPrihlaseni } from '@/lib/instagramServer';

/** Začátek připojení Instagramu (22. 9. 2026) - přesměruje na přihlášení u Instagramu. */
export const dynamic = 'force-dynamic';

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  if (!instagramNastaven()) {
    return NextResponse.json({ error: 'Na Vercelu chybí INSTAGRAM_APP_ID a INSTAGRAM_APP_SECRET.' }, { status: 503 });
  }
  const state = randomBytes(16).toString('hex');
  const res = NextResponse.redirect(odkazPrihlaseni(state));
  res.cookies.set('ig_state', state, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 600, path: '/' });
  return res;
}
