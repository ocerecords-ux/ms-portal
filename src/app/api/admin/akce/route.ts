import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { smiSpravovatAkce } from '@/lib/akceServer';
import { odpovedChyby } from '@/lib/chybyApi';

/**
 * FIREMNÍ AKCE (zadání 25. 11. 2026). Zakládá je ten, kdo je spravuje -
 * viz lib/akceServer.ts.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  nazev: z.string().trim().min(1, 'Název je povinný.').max(200),
  kdy: z.string().trim().max(40).nullable().optional(),
  misto: z.string().trim().max(300).nullable().optional(),
  text: z.string().trim().max(8000).nullable().optional(),
  odpovedDo: z.string().trim().max(40).nullable().optional(),
});

/** „2026-12-19T18:00" z formuláře; prázdno znamená „nevyplněno". */
function naDatum(hodnota: string | null | undefined): Date | null {
  if (!hodnota) return null;
  const d = new Date(hodnota.length <= 10 ? `${hodnota}T00:00:00` : hodnota);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function POST(req: NextRequest) {
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
  const d = parsed.data;

  try {
    const akce = await prisma.akce.create({
      data: {
        nazev: d.nazev,
        kdy: naDatum(d.kdy),
        misto: d.misto || null,
        text: d.text || null,
        odpovedDo: naDatum(d.odpovedDo),
        zalozilId: session.user.id,
        zalozilJmeno: session.user.name ?? null,
      },
      select: { id: true },
    });
    return NextResponse.json({ ok: true, id: akce.id }, { status: 201 });
  } catch (err) {
    console.error('POST /api/admin/akce selhalo:', err);
    return odpovedChyby('chybaApi.ulozeniNepodarilo', 500);
  }
}
