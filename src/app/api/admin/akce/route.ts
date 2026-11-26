import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { smiSpravovatAkce } from '@/lib/akceServer';
import { ocistiNakup, ocistiOtazky, VYCHOZI_OTAZKY, datumZPrahy } from '@/lib/akce';
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
  /** Vlastní odkaz na mapu; bez něj se hledá místo na Mapách Google. */
  mapa: z.string().trim().max(500).nullable().optional(),
  text: z.string().trim().max(8000).nullable().optional(),
  textPotvrzeni: z.string().trim().max(8000).nullable().optional(),
  textPripomenuti: z.string().trim().max(8000).nullable().optional(),
  odpovedDo: z.string().trim().max(40).nullable().optional(),
  /** Anketa - pořadatel si ji skládá sám (25. 11. 2026). */
  otazky: z.array(z.record(z.unknown())).max(30).optional(),
  nakup: z.array(z.record(z.unknown())).max(100).optional(),
});

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
        kdy: datumZPrahy(d.kdy),
        misto: d.misto || null,
        mapa: d.mapa || null,
        text: d.text || null,
        textPotvrzeni: d.textPotvrzeni || null,
        textPripomenuti: d.textPripomenuti || null,
        odpovedDo: datumZPrahy(d.odpovedDo),
        // Nová akce začíná s výchozí anketou; pořadatel si ji hned upraví.
        otazky: d.otazky ? ocistiOtazky(d.otazky) : VYCHOZI_OTAZKY,
        nakup: d.nakup ? ocistiNakup(d.nakup) : [],
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
