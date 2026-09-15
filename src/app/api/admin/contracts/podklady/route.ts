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
 *
 * Od 15. 9. 2026 k tomu přibyl NÁZEV PROJEKTU, DATUM ODEVZDÁNÍ a POLOŽKOVÉ
 * NÁKLADY (zadání: „Název smlouvy - bude si brát název projektu a jméno
 * herce", „dá na výběr položky z nákladů u projektu nebo i možnost napsat
 * ručně", „Termín dokončení natáčení - nastavit datum automaticky dle data
 * odevzdání projektu"). Všechno to portál zná, takže není důvod to
 * přepisovat ručně z jiné obrazovky.
 */
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await requireAdmin();
    if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

    const projekt = req.nextUrl.searchParams.get('projekt')?.trim();
    if (!projekt) return NextResponse.json({ herci: [], projekt: null, naklady: [] });

    const [meta, naklady] = await Promise.all([
      prisma.projectMeta.findUnique({
      where: { caflouProjectId: projekt },
      select: {
        name: true,
        endDate: true,
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
      }),
      prisma.projektNaklad.findMany({
        where: { caflouProjectId: projekt },
        orderBy: [{ poradi: 'asc' }, { createdAt: 'asc' }],
        select: { nazev: true, castka: true },
      }),
    ]);

    const herci = (meta?.herci ?? []).map((h) => ({
      id: h.id,
      jmeno: h.name || h.email,
      email: h.email,
      // Co se dostane do smlouvy jako identifikace - at je při výběru vidět,
      // jestli je čím člověka označit, nebo se to bude dopisovat ručně.
      identifikace: h.ic ? `IČO: ${h.ic}` : h.birthNumber ? `RČ: ${h.birthNumber}` : '',
      maAdresu: Boolean(h.addressStreet || h.addressCity || h.addressZip),
    }));

    return NextResponse.json({
      herci,
      projekt: { nazev: meta?.name ?? '', odevzdani: meta?.endDate ? meta.endDate.toISOString() : null },
      // Prazdne radky (clovek si zalozil polozku a nedopsal ji) do nabidky nepatri.
      naklady: naklady.filter((n) => n.nazev.trim() !== '' || n.castka > 0),
    });
  } catch (err) {
    console.error('GET /api/admin/contracts/podklady selhalo:', err);
    return NextResponse.json({ herci: [], projekt: null, naklady: [] });
  }
}
