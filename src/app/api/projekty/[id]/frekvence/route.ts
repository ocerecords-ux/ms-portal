import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { isInternalRole } from '@/lib/roles';
import { nactiRozpisProjektu } from '@/lib/frekvenceProjektuServer';

/**
 * ROZPIS NATÁČENÍ JEDNOHO PROJEKTU pro okénko u názvu (připomínka Helči
 * 15. 10. 2026).
 *
 * Čte se až při otevření okénka, ne s přehledem - stejně jako díly série.
 * Sedm set projektů v seznamu znamená sedm set rozpisů, které si nikdo
 * neotevře.
 *
 * JEN PRO TÝM. Klient natáčecí plán nevidí a tohle by mu ho prozradilo.
 */
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isInternalRole(session.user.role)) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }

  const { id } = await params;
  const rozpis = await nactiRozpisProjektu(id).catch((err) => {
    console.error('Rozpis natáčení se nepodařilo načíst:', err);
    return [];
  });
  return NextResponse.json({ rozpis });
}
