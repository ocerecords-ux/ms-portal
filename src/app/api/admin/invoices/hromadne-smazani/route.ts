import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';

/**
 * HROMADNÉ SMAZÁNÍ STORNOVANÝCH FAKTUR (zadání 17. 9. 2026: „a co stornované
 * faktury? Ty potřebuju taky mazat").
 *
 * SMAŽE JEN STORNOVANÉ. Je to tentýž postup jako u mazání po jedné (viz
 * [id]/route.ts, zadání 13. 9. 2026): první krok doklad stornuje, teprve
 * stornovaný jde smazat natrvalo. Odeslaná ani uhrazená faktura se tudy
 * ztratit nedá - a hlídá to server, ne jen to, co jde v tabulce zaškrtnout.
 *
 * ROZPRACOVANÉ SEM TAKY NEPATŘÍ: u nich mazání po jedné vrací číslo zpátky do
 * řady, což je jiná práce než smazat stornovaný doklad. Kdo chce zahodit
 * rozpracovanou fakturu, udělá to v jejím detailu.
 *
 * Číslo stornované faktury se do řady nevrací - v číselné řadě zůstane díra.
 * Tak to bylo i u mazání po jedné; účetně je storno událost, ne překlep.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  ids: z.array(z.string().trim().min(1)).min(1, 'Nevybrali jste žádnou fakturu.').max(300),
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

    const faktury = await prisma.invoice.findMany({
      where: { id: { in: ids } },
      select: { id: true, status: true },
    });
    const keSmazani = faktury.filter((f) => f.status === 'CANCELLED').map((f) => f.id);
    const jine = faktury.length - keSmazani.length;

    if (keSmazani.length === 0) {
      return NextResponse.json(
        {
          error:
            jine > 0
              ? 'Smazat jde jen stornovaná faktura — ostatní se musí nejdřív stornovat.'
              : 'Nenašli jsme, co smazat.',
        },
        { status: 409 },
      );
    }

    // Polozky a prilohy odchazi s fakturou (onDelete: Cascade v schema.prisma).
    const { count } = await prisma.invoice.deleteMany({ where: { id: { in: keSmazani } } });

    return NextResponse.json({ smazano: count, preskoceno: jine });
  } catch (err) {
    console.error('POST /api/admin/invoices/hromadne-smazani selhalo:', err);
    const message = err instanceof Error ? err.message : 'Neznámá chyba.';
    return NextResponse.json({ error: `Smazání se nezdařilo (${message}).` }, { status: 500 });
  }
}
