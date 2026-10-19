import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';
import { automatickaFakturaReklamy } from '@/lib/automatickaFakturaServer';

/**
 * VYSTAVIT A ODESLAT FAKTURU Z NABÍDKY RUČNĚ (19. 10. 2026).
 *
 * Automat jede na PŘECHODU do stavu „Schváleno - k fakturaci", ne na tom, že
 * v něm projekt stojí. Zakázka, která do stavu přeskočila dřív, než tohle
 * existovalo - nebo u které automat odstoupil, protože něco chybělo - se tedy
 * sama nespustí a stav by se musel přehazovat tam a zpátky.
 *
 * Tohle je to tlačítko. Dělá přesně totéž co automat, jen se o výsledku
 * nezvoní: odpověď si přečte ten, kdo klikl. Všechny pojistky platí dál -
 * jen u reklam, jen jedna nabídka, a nikdy druhá faktura (viz
 * lib/automatickaFakturaServer.ts).
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdmin();
    if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

    const meta = (await prisma.projectMeta.findUnique({
      where: { caflouProjectId: params.id },
      select: { name: true, companyName: true, company: { select: { name: true } } },
    })) as { name: string | null; companyName: string | null; company: { name: string } | null } | null;

    const vysledek = await automatickaFakturaReklamy({
      caflouProjectId: params.id,
      nazevProjektu: meta?.name ?? null,
      nazevFirmy: meta?.company?.name ?? meta?.companyName ?? null,
      kdo: { id: session.user.id, jmeno: session.user.name || session.user.email || null },
      rucne: true,
    });

    return NextResponse.json(vysledek, { status: vysledek.ok ? 200 : 409 });
  } catch (err) {
    console.error('POST /api/projekty/[id]/automaticka-faktura selhalo:', err);
    const message = err instanceof Error ? err.message : 'Neznámá chyba.';
    return NextResponse.json({ error: `Nepodařilo se to (${message}).` }, { status: 500 });
  }
}
