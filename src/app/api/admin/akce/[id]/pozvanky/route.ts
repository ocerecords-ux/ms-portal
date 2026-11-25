import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { pridejPozvane, smiSpravovatAkce } from '@/lib/akceServer';
import { odpovedChyby } from '@/lib/chybyApi';

/**
 * KOHO POZVAT. Přidání je hromadné (zaškrtaný seznam lidí), odebrání po
 * jednom - a jen dokud pozvánka neodešla: co už je v cizí schránce, se
 * odebráním ze seznamu neodestane.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  lide: z
    .array(
      z.object({
        userId: z.string().trim().max(60).nullable().optional(),
        jmeno: z.string().trim().max(200),
        email: z.string().trim().email('Neplatná adresa.').max(200),
      }),
    )
    .max(500)
    .optional(),
  /** ID pozvánky k odebrání ze seznamu. */
  odebrat: z.string().trim().max(60).optional(),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !(await smiSpravovatAkce(session.user.id))) {
    return odpovedChyby('chybaApi.bezOpravneni', 403);
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return parsed.error.issues[0]?.message
      ? NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
      : odpovedChyby('chybaApi.neplatnaData', 400);
  }

  try {
    if (parsed.data.odebrat) {
      const pozvanka = await prisma.pozvankaNaAkci.findUnique({
        where: { id: parsed.data.odebrat },
        select: { akceId: true, odeslanoAt: true },
      });
      if (!pozvanka || pozvanka.akceId !== params.id) {
        return odpovedChyby('chybaApi.neplatnaData', 404);
      }
      if (pozvanka.odeslanoAt) {
        return NextResponse.json(
          { error: 'Tahle pozvánka už odešla, ze seznamu ji vzít nejde.' },
          { status: 409 },
        );
      }
      await prisma.pozvankaNaAkci.delete({ where: { id: parsed.data.odebrat } });
      return NextResponse.json({ ok: true, odebrano: 1 });
    }

    const pridano = await pridejPozvane(params.id, parsed.data.lide ?? []);
    return NextResponse.json({ ok: true, pridano });
  } catch (err) {
    console.error('POST /api/admin/akce/[id]/pozvanky selhalo:', err);
    return odpovedChyby('chybaApi.ulozeniNepodarilo', 500);
  }
}
