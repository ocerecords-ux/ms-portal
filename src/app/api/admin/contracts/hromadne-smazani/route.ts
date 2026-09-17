import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';

/**
 * HROMADNÉ SMAZÁNÍ SMLUV (zadání 17. 9. 2026: „ve smlouvách bych potřeboval
 * v záložce Odmítnuté a zrušené mít možnost je hromadně nebo individuálně
 * vybrat a smazat").
 *
 * Odmítnutých a zrušených smluv se nasbírá nejvíc - vznikají při zkoušení
 * a překlepech a mazat je po jedné je práce navíc.
 *
 * PODEPSANOU SMLOUVU TO NESMAŽE. Je to stejné pravidlo jako u mazání po jedné
 * (viz [id]/route.ts) a hlídá se tady na serveru, ne jen tím, které řádky jde
 * v tabulce zaškrtnout: podepsaný dokument je závazek obou stran a jeho
 * zmizení by nikdo nedohledal. Když se takové ID v seznamu objeví, zbytek se
 * smaže a odpověď řekne, kolik se jich vynechalo.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  ids: z.array(z.string().trim().min(1)).min(1, 'Nevybrali jste žádnou smlouvu.').max(300),
});

export async function POST(req: NextRequest) {
  try {
    const session = await requireAdmin();
    if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Neplatná data.' },
        { status: 400 },
      );
    }
    const ids = Array.from(new Set(parsed.data.ids));

    const smlouvy = await prisma.contract.findMany({
      where: { id: { in: ids } },
      select: { id: true, status: true },
    });
    const keSmazani = smlouvy.filter((s) => s.status !== 'SIGNED').map((s) => s.id);
    const podepsane = smlouvy.length - keSmazani.length;

    if (keSmazani.length === 0) {
      return NextResponse.json(
        {
          error: podepsane > 0 ? 'Podepsanou smlouvu nelze smazat.' : 'Nenašli jsme, co smazat.',
        },
        { status: 409 },
      );
    }

    // Podpisy odejdou s nimi (onDelete: Cascade v schema.prisma).
    const { count } = await prisma.contract.deleteMany({ where: { id: { in: keSmazani } } });

    return NextResponse.json({ smazano: count, podepsane });
  } catch (err) {
    console.error('POST /api/admin/contracts/hromadne-smazani selhalo:', err);
    const message = err instanceof Error ? err.message : 'Neznámá chyba.';
    return NextResponse.json({ error: `Smazání se nezdařilo (${message}).` }, { status: 500 });
  }
}
