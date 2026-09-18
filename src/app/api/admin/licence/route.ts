import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';
import { jeKlicIkony } from '@/lib/ikonyTypu';

/**
 * ČÍSELNÍK DRUHŮ LICENCE (zadání 18. 9. 2026: „ty druhy licencí bych
 * potřeboval taky někde přidávat a editovat").
 *
 * Stejný princip jako u typů projektu: hodnoty nejsou v kódu, tým si je
 * spravuje sám v Cenících. Projekt jich může mít víc naráz.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  nazev: z.string().trim().min(1, 'Napište název druhu licence.').max(60),
  ikona: z.string().trim().optional(),
  poradi: z.number().int().optional(),
});

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  const druhy = await prisma.druhLicence.findMany({ orderBy: [{ poradi: 'asc' }, { nazev: 'asc' }] });
  return NextResponse.json({ druhy });
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Neplatná data.' }, { status: 400 });
  }
  const { nazev, ikona, poradi } = parsed.data;

  // Dvakrát tentýž druh by u projektu nešlo rozeznat.
  const uz = await prisma.druhLicence.findUnique({ where: { nazev } });
  if (uz) return NextResponse.json({ error: 'Takový druh licence už v číselníku je.' }, { status: 409 });

  const druh = await prisma.druhLicence.create({
    data: {
      nazev,
      ikona: ikona && jeKlicIkony(ikona) ? ikona : null,
      poradi: poradi ?? 100,
    },
  });
  return NextResponse.json({ druh }, { status: 201 });
}
