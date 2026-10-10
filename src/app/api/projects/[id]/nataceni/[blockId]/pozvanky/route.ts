import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { authOptions } from '@/lib/auth';
import { canManageCalendar } from '@/lib/roles';
import { nactiNataceni, posliPozvanky } from '@/lib/hosteNataceniServer';

/**
 * ODESLÁNÍ POZVÁNEK (zadání 30. 9. 2026: „maily, na které jim rovnou odejde
 * pozvánka na natáčení").
 *
 * VÝCHOZÍ JE „JEN KOMU JEŠTĚ NEŠLA". Produkce přidá dalšího člověka a klikne
 * znovu; ostatním se tím mail nezopakuje. Kdo má pozvánku na jiný (starší)
 * čas, do „nových" spadne taky - platí mu jiný termín.
 *
 * ODPOVĚDI CHODÍ TOMU, KDO POZVÁNKU POSLAL. Host odpovídá „dorazím o půl
 * hodiny později" a to má číst produkce, ne společná schránka portálu.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({ vsem: z.boolean().optional() });

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; blockId: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Nepřihlášeno.' }, { status: 401 });
  if (!canManageCalendar(session.user.role)) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }

  const { id, blockId } = await params;
  const nalezeno = await nactiNataceni(blockId);
  if (!nalezeno || nalezeno.caflouProjectId !== id) {
    return NextResponse.json({ error: 'Natáčení nenalezeno.' }, { status: 404 });
  }

  const telo = await req.json().catch(() => ({}));
  const data = schema.safeParse(telo ?? {});
  const vsem = data.success ? Boolean(data.data.vsem) : false;

  const meta = await prisma.projectMeta
    .findUnique({ where: { caflouProjectId: id }, select: { name: true } })
    .catch(() => null);

  const vysledek = await posliPozvanky(blockId, {
    jenNove: !vsem,
    odpovedNa: session.user.email ?? null,
    projectName: (meta as { name: string | null } | null)?.name ?? null,
    odeslalId: session.user.id ?? null,
  });

  const nove = await nactiNataceni(blockId);
  return NextResponse.json({ ...vysledek, nataceni: nove?.data ?? null });
}
