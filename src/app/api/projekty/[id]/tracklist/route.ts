import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { isInternalRole } from '@/lib/roles';
import { nactiTracklist, generovaniZTextuPovoleno } from '@/lib/tracklistServer';
import { upravNazevTracku } from '@/lib/tracklist';

/**
 * TRACKLIST AUDIOKNIHY (zadání 15. 10. 2026).
 *
 * GET  seznam stop
 * PUT  uloží celý seznam najednou (viz model TrackProjektu)
 *
 * Odnikud se nic nenačítá (upřesnění 15. 10. 2026: „nechci nikde načítat
 * tracklist") - tracklist je předpis, podle kterého se stopy teprve
 * pojmenují, ne soupis toho, co na Disku leží.
 *
 * Jen náš tým: je to výrobní podklad, podle kterého se pojmenují finální
 * soubory. Klientovi se zatím neukazuje.
 */
export const dynamic = 'force-dynamic';

async function jaInterni() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !isInternalRole(session.user.role)) return null;
  return session.user;
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await jaInterni())) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

  return NextResponse.json({ tracky: await nactiTracklist(params.id) });
}

const schema = z.object({
  tracky: z
    .array(
      z.object({
        nazevTracku: z.string().trim().max(300),
        nazevKapitoly: z.string().trim().max(300),
      }),
    )
    .max(500),
});

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await jaInterni())) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Neplatná data.' }, { status: 400 });
  }
  /**
   * MODEL POJMENOVÁNÍ ROZHODUJE FIRMA, ne obrazovka (30. 10. 2026: „ještě
   * jsem upravil vzor: 02_1938 - KAPITOLA 1."). U firmy, která má zapnuté
   * generování z textu, mezery v názvu zůstávají; jinak se mění na pomlčky
   * jako dosud. Bez tohohle řádku by server uloženému názvu mezery přepsal
   * a vygenerovaný tracklist by se po uložení rozsypal.
   */
  const sMezerami = await generovaniZTextuPovoleno(params.id);

  // Úplně prázdné řádky se zahazují - vznikají klepnutím na „Přidat stopu"
  // navíc. Stačí ale vyplněný jeden ze dvou názvů, aby řádek zůstal.
  const tracky = parsed.data.tracky
    // Tvar názvu tracku se hlídá i tady, ne jen v prohlížeči - je to
    // pravidlo předpisu, ne vlastnost jednoho formuláře (15. 10. 2026).
    .map((t) => ({
      nazevTracku: upravNazevTracku(t.nazevTracku, sMezerami),
      nazevKapitoly: t.nazevKapitoly.trim(),
    }))
    .filter((t) => t.nazevTracku || t.nazevKapitoly);

  try {
    // Celý seznam naráz: staré pryč, nové podle pořadí v poli. Jedna
    // transakce, takže v půlce uložení nikdo neuvidí poloviční tracklist.
    await prisma.$transaction([
      prisma.trackProjektu.deleteMany({ where: { caflouProjectId: params.id } }),
      prisma.trackProjektu.createMany({
        data: tracky.map((t, i) => ({ caflouProjectId: params.id, poradi: i + 1, ...t })),
      }),
    ]);
    return NextResponse.json({ tracky: await nactiTracklist(params.id) });
  } catch (err) {
    console.error('Tracklist: ulozeni selhalo:', err);
    return NextResponse.json({ error: 'Uložení se nepodařilo.' }, { status: 500 });
  }
}
