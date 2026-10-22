import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';

/**
 * Kategorie techniky (22. 10. 2026). Zakládají se v portálu, ne v kódu -
 * viz model TechnikaKategorie.
 *
 * SMAZÁNÍ KATEGORIE NESMAŽE TECHNIKU: kusy v ní zůstanou a spadnou do
 * „Bez kategorie" (v databázi `onDelete: SetNull`).
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  nazev: z.string().trim().min(1, 'Název je povinný.').max(120),
  poradi: z.number().int().min(0).max(10000).optional(),
});

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

  try {
    const posledni = await prisma.technikaKategorie.findFirst({
      orderBy: { poradi: 'desc' },
      select: { poradi: true },
    });
    const kategorie = await prisma.technikaKategorie.create({
      data: {
        nazev: parsed.data.nazev,
        poradi: parsed.data.poradi ?? (posledni?.poradi ?? 0) + 10,
      },
      select: { id: true },
    });
    return NextResponse.json({ ok: true, id: kategorie.id });
  } catch (err) {
    console.error('POST /api/admin/technika/kategorie selhalo:', err);
    return NextResponse.json(
      { error: 'Kategorii se nepodařilo založit - nemá už takový název?' },
      { status: 500 },
    );
  }
}
