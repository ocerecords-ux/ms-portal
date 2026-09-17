import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';
import { bezTitulu } from '@/lib/jmena';
import { hercizRozpoctu } from '@/lib/nakladHerce';

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
        licenceUziti: true,
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

    const naZaznam = (h: {
      id: string;
      name: string | null;
      email: string;
      ic: string | null;
      birthNumber: string | null;
      addressStreet: string | null;
      addressCity: string | null;
      addressZip: string | null;
    }) => ({
      id: h.id,
      jmeno: bezTitulu(h.name) || h.email,
      email: h.email,
      // Co se dostane do smlouvy jako identifikace - at je při výběru vidět,
      // jestli je čím člověka označit, nebo se to bude dopisovat ručně.
      identifikace: h.ic ? `IČO: ${h.ic}` : h.birthNumber ? `RČ: ${h.birthNumber}` : '',
      maAdresu: Boolean(h.addressStreet || h.addressCity || h.addressZip),
      /** Částka z položky rozpočtu, která na něj sedí. */
      castka: null as number | null,
      /** Pořadí té položky v `naklady` níž - formulář ji podle toho rovnou vybere. */
      nakladIndex: null as number | null,
      /** Je tu jen proto, že ho portál našel v rozpočtu, ne u projektu? */
      zRozpoctu: false,
    });

    const herci = (meta?.herci ?? []).map(naZaznam);

    // Prazdne radky (clovek si zalozil polozku a nedopsal ji) do nabidky nepatri.
    // Filtruje se JESTE PRED parovanim herců, aby poradi polozky, ktere se
    // posila do formulare, sedelo na to, co si clovek vybira v selectu.
    const polozky = naklady.filter((n) => n.nazev.trim() !== '' || n.castka > 0);

    /**
     * HERCI Z ROZPOČTU (zadání 17. 9. 2026: „u projektu Strabag mám
     * v rozpočtu konkrétní herce a částky... chci přímo vybrat herce a aby se
     * načetly jeho údaje i částka z rozpočtu").
     *
     * U reklam se herci k projektu často nenavazují jako účty - jen se napíšou
     * do rozpočtu. Portál je proto v těch řádcích zkusí poznat a nabídne je
     * k výběru i s částkou. Kdo je u projektu navázaný, dostane jen částku;
     * nepřidává se podruhé.
     *
     * Jistota je na prvním místě: jméno musí v položce sedět celé (nebo
     * příjmení, které v portálu nosí jediný herec) - viz lib/nakladHerce.ts.
     */
    const kandidati = await prisma.user.findMany({
      where: { role: 'HEREC', active: true },
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
    });
    const podleId = new Map(kandidati.map((k) => [k.id, k]));
    const nalezeni = hercizRozpoctu(
      polozky,
      kandidati.map((k) => ({ id: k.id, jmeno: bezTitulu(k.name) || k.email })),
    );

    for (const { clovek, castka, index } of nalezeni) {
      const uz = herci.find((h) => h.id === clovek.id);
      if (uz) {
        if (uz.castka === null) {
          uz.castka = castka;
          uz.nakladIndex = index;
        }
        continue;
      }
      const ucet = podleId.get(clovek.id);
      if (!ucet) continue;
      herci.push({ ...naZaznam(ucet), castka, nakladIndex: index, zRozpoctu: true });
    }

    return NextResponse.json({
      herci,
      projekt: {
        nazev: meta?.name ?? '',
        odevzdani: meta?.endDate ? meta.endDate.toISOString() : null,
        // Ucel a uzemi uziti licence - predvyplni se do smlouvy (17. 9. 2026).
        licenceUziti: meta?.licenceUziti ?? null,
      },
      naklady: polozky,
    });
  } catch (err) {
    console.error('GET /api/admin/contracts/podklady selhalo:', err);
    return NextResponse.json({ herci: [], projekt: null, naklady: [] });
  }
}
