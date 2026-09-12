import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { nactiDotazyKlienta } from '@/lib/dotazyServer';

/**
 * Seznam projektů klienta do doku dotazů (zadání 12. 9. 2026). Jen projekty
 * jeho firmy, kde je vedený jako kontaktní osoba — stejný výběr jako
 * v přehledu projektů.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Nepřihlášeno.' }, { status: 401 });
  const companyId = session.user.companyId;
  if (!companyId) return NextResponse.json({ projekty: [] });

  try {
    const projekty = await nactiDotazyKlienta(companyId, session.user.id);
    return NextResponse.json({ projekty });
  } catch (err) {
    console.error('GET /api/dotazy selhalo:', err);
    return NextResponse.json({ projekty: [], chyba: 'Dotazy se teď nepodařilo načíst.' });
  }
}
