import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canViewProjectDocuments } from '@/lib/roles';
import { zalozNabidkuZVystupu } from '@/lib/nabidkaZVystupu';

/**
 * NABÍDKA Z VÝSTUPŮ (zadání 26. 9. 2026, etapa 5).
 *
 * Kdo to smí: ten, kdo vůbec vidí doklady projektu (`canViewProjectDocuments`,
 * tedy Žůžo-labůžo) - nabídka je doklad s číslem z řady, ne poznámka
 * u projektu. Produkce si výstupy vyplní, doklad z nich udělá účtárna.
 *
 * Doklad vzniká ROZPRACOVANÝ; ceny se doplní jen tam, kde je zná ceník.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Nepřihlášeno.' }, { status: 401 });
  if (!canViewProjectDocuments(session.user.role)) {
    return NextResponse.json({ error: 'Nemáte oprávnění zakládat doklady.' }, { status: 403 });
  }

  const { id } = await params;
  const meta = await prisma.projectMeta.findUnique({
    where: { caflouProjectId: id },
    select: { name: true },
  });

  const vysledek = await zalozNabidkuZVystupu(id, meta?.name || `Projekt ${id}`);
  if (!vysledek.ok) return NextResponse.json({ error: vysledek.duvod }, { status: 409 });

  return NextResponse.json({ id: vysledek.id, number: vysledek.number });
}
