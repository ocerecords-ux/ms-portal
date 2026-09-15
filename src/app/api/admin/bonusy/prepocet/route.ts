import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminGuard';
import { prepoctiBonusyHotovych } from '@/lib/bonusyServer';

/**
 * Dohnání návrhů bonusů u knih, které byly schválené dřív, než portál bonusy
 * uměl (zadání 15. 9. 2026).
 *
 * Nic nepřepisuje ani neschvaluje - jen projde hotové audioknihy a založí
 * návrhy, které chybí. Pustit se to dá kolikrát chce.
 */
export const dynamic = 'force-dynamic';

export async function POST() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

  try {
    const vysledek = await prepoctiBonusyHotovych();
    return NextResponse.json({ ok: true, ...vysledek });
  } catch (err) {
    console.error('POST /api/admin/bonusy/prepocet selhalo:', err);
    return NextResponse.json({ error: 'Přepočet se nepodařil.' }, { status: 500 });
  }
}
