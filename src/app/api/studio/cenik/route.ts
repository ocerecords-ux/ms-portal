import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { smiSpravovatCenik, ulozCenik, zajistiCenik } from '@/lib/studioCenikServer';

/**
 * Ceník studia - načtení a uložení (zadání 28. 9. 2026).
 *
 * Ukládá se CELÝ NAJEDNOU, ne po políčkách: je to jeden dokument, který se
 * mění vcelku a pak posílá ven. Kdo smí, řeší `smiSpravovatCenik` - Žůžo-labůžo
 * všude, vedoucí pobočky ve svém studiu.
 */

const radek = z.object({
  popis: z.string().trim().min(1).max(160),
  cena1Minor: z.number().int().min(0).max(100_000_000).nullable(),
  cena2Minor: z.number().int().min(0).max(100_000_000).nullable(),
  od1: z.boolean(),
  od2: z.boolean(),
});

const schema = z.object({
  studioId: z.string().trim().min(1),
  nadpis: z.string().trim().min(1).max(120),
  podnadpis: z.string().trim().max(160).optional(),
  // Prázdno = platnost se neuvádí.
  platnostDo: z.string().trim().regex(/^(\d{4}-\d{2}-\d{2})?$/).optional(),
  mena: z.enum(['CZK', 'EUR', 'USD', 'GBP']),
  sloupec1: z.string().trim().min(1).max(60),
  sloupec1Popis: z.string().trim().max(400).optional(),
  sloupec2: z.string().trim().max(60).optional(),
  sloupec2Popis: z.string().trim().max(400).optional(),
  poznamka: z.string().trim().max(1000).optional(),
  radky: z.array(radek).min(1).max(40),
});

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Nepřihlášeno.' }, { status: 401 });

  const studioId = req.nextUrl.searchParams.get('studio')?.trim();
  if (!studioId) return NextResponse.json({ error: 'Chybí studio.' }, { status: 400 });
  if (!(await smiSpravovatCenik(session.user.id, session.user.role as never, studioId))) {
    return NextResponse.json({ error: 'Na ceník tohohle studia nemáte právo.' }, { status: 403 });
  }

  try {
    return NextResponse.json({ cenik: await zajistiCenik(studioId) });
  } catch (err) {
    console.error('GET /api/studio/cenik selhalo:', err);
    return NextResponse.json({ error: 'Ceník se nepodařilo načíst.' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Nepřihlášeno.' }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Neplatná data.' }, { status: 400 });
  const d = parsed.data;

  if (!(await smiSpravovatCenik(session.user.id, session.user.role as never, d.studioId))) {
    return NextResponse.json({ error: 'Na ceník tohohle studia nemáte právo.' }, { status: 403 });
  }

  try {
    const cenik = await ulozCenik(
      d.studioId,
      {
        nadpis: d.nadpis,
        podnadpis: d.podnadpis ?? null,
        platnostDo: d.platnostDo ?? '',
        mena: d.mena,
        sloupec1: d.sloupec1,
        sloupec1Popis: d.sloupec1Popis ?? null,
        sloupec2: d.sloupec2 ?? null,
        sloupec2Popis: d.sloupec2Popis ?? null,
        poznamka: d.poznamka ?? null,
        radky: d.radky,
      },
      { id: session.user.id, jmeno: session.user.name || session.user.email || null },
    );
    return NextResponse.json({ ok: true, cenik });
  } catch (err) {
    console.error('PUT /api/studio/cenik selhalo:', err);
    return NextResponse.json({ error: 'Ceník se nepodařilo uložit.' }, { status: 500 });
  }
}
