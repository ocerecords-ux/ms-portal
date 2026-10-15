import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { isInternalRole } from '@/lib/roles';
import { ZNACKY_KALENDARU } from '@/lib/vychoziKalendare';

/**
 * VÝCHOZÍ ZAPNUTÍ KALENDÁŘŮ (zadání Helči, 15. 10. 2026: „prosím o možnost
 * nastavit si výchozí zapnutí kalendářů. Abych měla, když zapnu kalendář,
 * defaultně zapnuté Brno I, Brno II, Praha").
 *
 * Uloží se to, co má člověk zrovna rozsvícené, a platí to pro něj samotného -
 * kalendář otevřený bez parametrů v adrese se takhle rozsvítí. Odkaz s
 * parametry (třeba z hledání nebo z e-mailu) má pořád přednost, aby sdílený
 * odkaz ukazoval všem totéž.
 */

const schema = z.object({
  /** Id studií a značky ostatních kalendářů - viz lib/vychoziKalendare.ts. */
  kalendare: z.array(z.string().trim().min(1)).max(50),
});

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !isInternalRole(session.user.role)) {
    return NextResponse.json({ error: 'Nepřihlášeno.' }, { status: 401 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Neplatná data.' }, { status: 400 });
  }

  // Projdou jen existující studia a známé značky - ať v nastavení nezůstane
  // viset studio, které se mezitím zrušilo.
  const studia = await prisma.studio.findMany({ select: { id: true } });
  const povolene = new Set<string>([...studia.map((s) => s.id), ...ZNACKY_KALENDARU]);
  const kalendare = Array.from(new Set(parsed.data.kalendare.filter((k) => povolene.has(k))));

  await prisma.user.update({
    where: { id: session.user.id },
    data: { vychoziKalendare: kalendare, vychoziKalendareNastaveno: true },
  });

  return NextResponse.json({ ok: true, kalendare });
}

/** Zrušení vlastního nastavení - kalendář se vrátí k „svítí všechno". */
export async function DELETE() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !isInternalRole(session.user.role)) {
    return NextResponse.json({ error: 'Nepřihlášeno.' }, { status: 401 });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { vychoziKalendare: [], vychoziKalendareNastaveno: false },
  });

  return NextResponse.json({ ok: true });
}
