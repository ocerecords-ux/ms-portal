import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { isInternalRole } from '@/lib/roles';
import { nactiPrirucku } from '@/lib/brunoPrirucka';
import { brunoUpravTracklist, jeBrunoNastaveny } from '@/lib/brunoTracklist';
import { generovaniZTextuPovoleno } from '@/lib/tracklistServer';

/**
 * BRUNO U TRACKLISTU (zadání 30. 10. 2026: „u těch tracklistů by mohl být
 * Bruno… normálně chatovací okno").
 *
 * Jen náš tým - je to výrobní podklad, klient ho nevidí.
 *
 * TRACKLIST CHODÍ Z PROHLÍŽEČE, ne z databáze: v tabulce bývají rozdělané
 * změny, které ještě nikdo neuložil, a Bruno má pracovat s tím, co člověk
 * vidí před sebou. Zpátky se taky jen vrací - nic se tu neukládá, na to je
 * PUT o patro výš.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const schema = z.object({
  zprava: z.string().trim().min(1).max(2000),
  tracky: z
    .array(
      z.object({
        nazevTracku: z.string().max(300),
        nazevKapitoly: z.string().max(300),
      }),
    )
    .max(500),
  /** Co už v okně padlo, ať Bruno navazuje. Nejstarší první. */
  historie: z
    .array(z.object({ odBruna: z.boolean(), text: z.string().max(4000) }))
    .max(40)
    .default([]),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !isInternalRole(session.user.role)) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }
  if (!jeBrunoNastaveny()) {
    return NextResponse.json({ error: 'Bruno teď není k dispozici.' }, { status: 503 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Neplatná data.' }, { status: 400 });
  }

  const meta = await prisma.projectMeta
    .findUnique({ where: { caflouProjectId: params.id }, select: { name: true } })
    .catch(() => null);

  const odpoved = await brunoUpravTracklist({
    jmeno: session.user.name || session.user.email || 'kolega',
    nazevProjektu: meta?.name || '',
    prirucka: await nactiPrirucku(),
    tracky: parsed.data.tracky,
    zpravy: [...parsed.data.historie, { odBruna: false, text: parsed.data.zprava }],
    sMezerami: await generovaniZTextuPovoleno(params.id),
  });

  return NextResponse.json(odpoved);
}
