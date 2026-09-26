import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { canEditProjectMeta } from '@/lib/roles';
import { vyrobNataceciText } from '@/lib/nataceniTextServer';

/**
 * NATÁČECÍ TEXT NA DISK (zadání 26. 9. 2026: „ukládalo by se to do
 * editovatelného dokumentu na disku ve složce projektu").
 *
 * Kdo smí: stejný kruh jako u ostatních interních atributů projektu -
 * produkce a Žůžo-labůžo. Dokument vzniká VŽDYCKY NOVÝ; portál do už
 * vyrobeného nesahá, aby se rozepsaný text nikdy nepřepsal.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({ vzorId: z.string().trim().min(1).nullable().optional() });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Nepřihlášeno.' }, { status: 401 });
  if (!canEditProjectMeta(session.user.role)) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }

  const { id } = await params;
  const telo = await req.json().catch(() => ({}));
  const data = schema.safeParse(telo ?? {});

  const vysledek = await vyrobNataceciText(id, data.success ? data.data.vzorId ?? null : null);
  if (!vysledek.ok) return NextResponse.json({ error: vysledek.duvod }, { status: 409 });

  return NextResponse.json({ url: vysledek.url, nazev: vysledek.nazev });
}
