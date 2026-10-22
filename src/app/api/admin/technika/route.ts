import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';

/**
 * TECHNIKA (zadání 22. 10. 2026: „potřebuju vytvořit kategorii, kde bude
 * seznam techniky. Bude rozdělen do kategorií… i na studia, kde která
 * technika je").
 *
 * Inventura, ne půjčovna: co máme, co to je a ve kterém studiu to stojí.
 * Kategorie i kusy zakládá administrace, klient se sem nedostane.
 *
 * VYŘAZENÉ SE NEMAŽE. `vyrazeno` jen schová kus z výpisu - po roce se
 * u sériového čísla pořád dá dohledat, že jsme ten mikrofon měli.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  nazev: z.string().trim().min(1, 'Název je povinný.').max(200),
  kategorieId: z.string().trim().min(1).nullable().optional(),
  vyrobce: z.string().trim().max(120).nullable().optional(),
  model: z.string().trim().max(120).nullable().optional(),
  serioveCislo: z.string().trim().max(120).nullable().optional(),
  studioId: z.string().trim().min(1).nullable().optional(),
  poznamka: z.string().trim().max(4000).nullable().optional(),
  /** Fotka jako data: URL - viz schema.prisma. */
  foto: z.string().trim().max(3_000_000).nullable().optional(),
  vyrazeno: z.boolean().optional(),
});

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

  const [kategorie, kusy] = await Promise.all([
    prisma.technikaKategorie.findMany({ orderBy: [{ poradi: 'asc' }, { nazev: 'asc' }] }),
    prisma.technika.findMany({
      orderBy: [{ nazev: 'asc' }],
      select: {
        id: true,
        nazev: true,
        kategorieId: true,
        vyrobce: true,
        model: true,
        serioveCislo: true,
        studioId: true,
        poznamka: true,
        foto: true,
        vyrazeno: true,
      },
    }),
  ]);

  return NextResponse.json({ kategorie, kusy });
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Neplatná data.' },
      { status: 400 },
    );
  }
  const d = parsed.data;

  try {
    const kus = await prisma.technika.create({
      data: {
        nazev: d.nazev,
        kategorieId: d.kategorieId ?? null,
        vyrobce: d.vyrobce || null,
        model: d.model || null,
        serioveCislo: d.serioveCislo || null,
        studioId: d.studioId ?? null,
        poznamka: d.poznamka || null,
        foto: d.foto || null,
      },
      select: { id: true },
    });
    return NextResponse.json({ ok: true, id: kus.id });
  } catch (err) {
    console.error('POST /api/admin/technika selhalo:', err);
    return NextResponse.json({ error: 'Uložení se nepodařilo.' }, { status: 500 });
  }
}
