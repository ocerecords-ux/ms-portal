import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { isInternalRole } from '@/lib/roles';
import { klicSerie } from '@/lib/serie';

/**
 * DÍLY JEDNÉ SÉRIE (zadání 14. 10. 2026: „když jsem zadal celou sérii, tak ji
 * nevidím. Musím to vidět vždy, i když je to v dokončených").
 *
 * PROČ VLASTNÍ DOTAZ A NE SEZNAM Z TABULKY: okénko u kolečka si díly původně
 * skládalo z projektů, které měla tabulka zrovna vykreslené. Jenže aktivní
 * a dokončené projekty jsou dvě různé tabulky, takže ze třináctidílné série
 * bylo vidět sedm dílů a zbytek jako by nebyl. Série je série bez ohledu na
 * to, kde se který díl zrovna nachází.
 *
 * KDO CO VIDÍ: tým všechny díly, klient jen díly své firmy. Rozhoduje o tom
 * tahle route, ne okno v prohlížeči.
 */
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Nejste přihlášen.' }, { status: 401 });
  }

  const nazev = (req.nextUrl.searchParams.get('nazev') ?? '').trim();
  const klic = klicSerie(nazev);
  if (!klic) return NextResponse.json({ dily: [] });

  const interni = isInternalRole(session.user.role);
  const companyId = session.user.companyId ?? null;
  // Klient bez firmy nemá co vidět - vlastní projekty pozná jen přes ni.
  if (!interni && !companyId) return NextResponse.json({ dily: [] });

  try {
    const radky = await prisma.projectMeta.findMany({
      where: {
        serie: { not: null },
        name: { not: null },
        ...(interni ? {} : { companyId }),
      },
      select: { caflouProjectId: true, name: true, serie: true, serieDil: true },
      take: 2000,
    });

    const dily = radky
      .filter((r) => klicSerie(r.serie) === klic)
      .map((r) => ({ id: Number(r.caflouProjectId), name: r.name ?? '', dil: r.serieDil ?? null }))
      .sort((a, b) => {
        if (a.dil != null && b.dil != null) return a.dil - b.dil;
        if (a.dil != null) return -1;
        if (b.dil != null) return 1;
        return a.name.localeCompare(b.name, 'cs');
      });

    return NextResponse.json({ dily });
  } catch (err) {
    console.error('Díly série se nepodařilo načíst:', err);
    return NextResponse.json({ dily: [] });
  }
}
