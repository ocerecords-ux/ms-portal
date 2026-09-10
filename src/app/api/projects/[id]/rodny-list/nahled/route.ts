import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canEditProjectMeta } from '@/lib/roles';
import { nahledRodnehoListu } from '@/lib/rodnyListServer';

/**
 * Náhled Rodného listu (zadání 10. 9. 2026: „než se to někam uloží, vidět
 * nejdřív náhled").
 *
 * Vrací rovnou PDF k zobrazení v prohlížeči. NIC SE NEUKLÁDÁ - nevzniká
 * verze, nic se nenahrává do úložiště ani na Disk a klientovi se neozýváme.
 * Proto je to GET: podívat se dá kolikrát chce a nic se tím nezmění.
 *
 * Chyba se vrací jako JSON, ne jako prázdné PDF - ať je vidět, co chybí.
 */
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !canEditProjectMeta(session.user.role)) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }

  // Nazev projektu bereme z portalu; u projektu, ktery jeste neprosel
  // prenosem, muze byt prazdny - pak aspon cislo, at PDF neni bezejmenne.
  const meta = await prisma.projectMeta.findUnique({
    where: { caflouProjectId: params.id },
    select: { name: true, company: { select: { caflouCompanyId: true } } },
  });

  const vysledek = await nahledRodnehoListu(
    params.id,
    meta?.name || `Projekt ${params.id}`,
    meta?.company?.caflouCompanyId ?? null,
  );

  if (!vysledek.ok) {
    const status = vysledek.reason === 'FAILED' ? 500 : 409;
    return NextResponse.json({ error: vysledek.message }, { status });
  }

  return new NextResponse(new Uint8Array(vysledek.pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      // inline = otevre se v prohlizeci, ne stahne. Nahled je na koukani.
      'Content-Disposition': `inline; filename="${vysledek.fileName}"`,
      'Cache-Control': 'no-store',
    },
  });
}
