import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';

/**
 * Co portál o projektu ví, když se zakládá smlouva (zadání 13. 9. 2026:
 * „tady tyto věci portál ví. Podle projektu dá na výběr RČ nebo IČ herce
 * a název podle názvu projektu").
 *
 * Vrací herce navázané na projekt i s tím, čím se identifikují. Formulář
 * podle toho nabídne protistranu jedním kliknutím místo přepisování adresy
 * a rodného čísla z jiné obrazovky.
 */
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await requireAdmin();
    if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

    const projekt = req.nextUrl.searchParams.get('projekt')?.trim();
    if (!projekt) return NextResponse.json({ herci: [] });

    const meta = await prisma.projectMeta.findUnique({
      where: { caflouProjectId: projekt },
      select: {
        herci: {
          select: {
            id: true,
            name: true,
            email: true,
            ic: true,
            dic: true,
            birthNumber: true,
            addressStreet: true,
            addressCity: true,
            addressZip: true,
          },
        },
      },
    });

    const herci = (meta?.herci ?? []).map((h) => ({
      id: h.id,
      jmeno: h.name || h.email,
      email: h.email,
      // Co se dostane do smlouvy jako identifikace - at je při výběru vidět,
      // jestli je čím člověka označit, nebo se to bude dopisovat ručně.
      identifikace: h.ic ? `IČO: ${h.ic}` : h.birthNumber ? `RČ: ${h.birthNumber}` : '',
      maAdresu: Boolean(h.addressStreet || h.addressCity || h.addressZip),
    }));

    return NextResponse.json({ herci });
  } catch (err) {
    console.error('GET /api/admin/contracts/podklady selhalo:', err);
    return NextResponse.json({ herci: [] });
  }
}
