import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canEditProjectMeta } from '@/lib/roles';
import { z } from 'zod';
import { nahledRodnehoListu, type RozepsanyRodnyList } from '@/lib/rodnyListServer';

/**
 * Náhled Rodného listu (zadání 10. 9. 2026: „než se to někam uloží, vidět
 * nejdřív náhled").
 *
 * Vrací rovnou PDF k zobrazení v prohlížeči. NIC SE NEUKLÁDÁ - nevzniká
 * verze, nic se nenahrává do úložiště ani na Disk a klientovi se neozýváme.
 * Proto je to GET: podívat se dá kolikrát chce a nic se tím nezmění.
 *
 * Chyba se vrací jako JSON, ne jako prázdné PDF - ať je vidět, co chybí.
 *
 * GET čte uložené údaje, POST bere rozepsané hodnoty z formuláře (zadání
 * 10. 9. 2026: „když budu měnit údaje, tak se to bude měnit i v tom
 * náhledu"). Ani jedno nic neukládá.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  clientName: z.string().max(300).optional(),
  spotName: z.string().max(300).optional(),
  spotLengthSeconds: z.union([z.number(), z.string(), z.null()]).optional(),
  directorName: z.string().max(200).optional(),
  musicTitle: z.string().max(300).optional(),
  musicAuthor: z.string().max(300).optional(),
  noMusic: z.boolean().optional(),
  productionDate: z.string().max(20).optional(),
});

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  return vyrob(params.id, undefined);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Neplatná data.' }, { status: 400 });
  }
  const d = parsed.data;
  const delka =
    d.spotLengthSeconds === undefined
      ? undefined
      : d.spotLengthSeconds === null || d.spotLengthSeconds === ''
        ? null
        : Number(d.spotLengthSeconds);

  return vyrob(params.id, {
    ...d,
    spotLengthSeconds: delka !== undefined && delka !== null && !Number.isFinite(delka) ? null : delka,
  });
}

async function vyrob(caflouProjectId: string, rozepsane: RozepsanyRodnyList | undefined) {
  const session = await getServerSession(authOptions);
  if (!session || !canEditProjectMeta(session.user.role)) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }

  // Nazev projektu bereme z portalu; u projektu, ktery jeste neprosel
  // prenosem, muze byt prazdny - pak aspon cislo, at PDF neni bezejmenne.
  const meta = await prisma.projectMeta.findUnique({
    where: { caflouProjectId },
    select: { name: true, company: { select: { caflouCompanyId: true } } },
  });

  const vysledek = await nahledRodnehoListu(
    caflouProjectId,
    meta?.name || `Projekt ${caflouProjectId}`,
    meta?.company?.caflouCompanyId ?? null,
    rozepsane,
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
