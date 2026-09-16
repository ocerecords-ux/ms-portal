import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/db';
import { authOptions } from '@/lib/auth';
import { canViewProjectBudget } from '@/lib/roles';

/**
 * Položkové náklady projektu (zadání 11. 9. 2026: „do té karty mi dej třeba
 * položkové menu náklady, tak napíšu náklady na herce a tak dále").
 *
 * Ukládá se CELÝ SEZNAM najednou, ne řádek po řádku. Položek je pár a je to
 * jeden souvislý zápis — kdyby se posílaly po jedné, musel by portál řešit
 * pořadí, poloviční uložení a mizející id řádku, který ještě neexistuje.
 *
 * Vidí i mění to ten, kdo má právo na rozpočet projektu — Žůžo-labužo
 * a produkce (zadání 16. 9. 2026: „povol Helče, ať vidí položky rozpočtu
 * v detailu projektu"). Zvukař ne (zadání 11. 9. 2026: „zvukaři by neměli
 * vidět u projektů žádné doklady ani rozpočty").
 *
 * PSÁT SMÍ TEN, KDO ČTE: položkové náklady jsou přesně to, co do rozpočtu
 * píše produkce („napíšu náklady na herce"). Kdyby je směla jen číst,
 * zůstala by v kartě políčka, která při uložení vrátí 403.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  polozky: z
    .array(
      z.object({
        nazev: z.string().trim().max(200),
        // Cele koruny bez DPH. Zaporne cislo dava smysl jako oprava, proto
        // neni strop zdola nula - jen rozumny rozsah.
        castka: z.number().int().min(-10_000_000).max(10_000_000),
      }),
    )
    .max(50),
});

async function seznam(caflouProjectId: string) {
  const polozky = await prisma.projektNaklad.findMany({
    where: { caflouProjectId },
    orderBy: [{ poradi: 'asc' }, { createdAt: 'asc' }],
    select: { id: true, nazev: true, castka: true },
  });
  return { polozky };
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !canViewProjectBudget(session.user.role)) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }
  return NextResponse.json(await seznam(params.id));
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !canViewProjectBudget(session.user.role)) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Neplatná data.' }, { status: 400 });
  }

  // Prazdny nazev i nulova castka znamenaji nedopsany radek - ten se
  // neuklada, at v rozpoctu nezustavaji prazdne rady.
  const polozky = parsed.data.polozky
    .map((p, i) => ({ nazev: p.nazev.trim(), castka: p.castka, poradi: i }))
    .filter((p) => p.nazev.length > 0 || p.castka !== 0);

  await prisma.$transaction([
    prisma.projektNaklad.deleteMany({ where: { caflouProjectId: params.id } }),
    ...(polozky.length
      ? [
          prisma.projektNaklad.createMany({
            data: polozky.map((p) => ({ ...p, caflouProjectId: params.id })),
          }),
        ]
      : []),
  ]);

  return NextResponse.json(await seznam(params.id));
}
