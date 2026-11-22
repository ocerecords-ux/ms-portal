import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';
import { odpovedChyby } from '@/lib/chybyApi';

/** Přejmenování, pořadí a smazání kategorie techniky (22. 10. 2026). */
export const dynamic = 'force-dynamic';

const schema = z.object({
  nazev: z.string().trim().min(1).max(120).optional(),
  poradi: z.number().int().min(0).max(10000).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  if (!session) return odpovedChyby('chybaApi.bezOpravneni', 403);

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return odpovedChyby('chybaApi.neplatnaData', 400);

  try {
    await prisma.technikaKategorie.update({
      where: { id: params.id },
      data: {
        ...(parsed.data.nazev !== undefined ? { nazev: parsed.data.nazev } : {}),
        ...(parsed.data.poradi !== undefined ? { poradi: parsed.data.poradi } : {}),
      },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('PATCH kategorie techniky selhalo:', err);
    return odpovedChyby('chybaApi.technikaKategorieNeulozena', 500);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  if (!session) return odpovedChyby('chybaApi.bezOpravneni', 403);

  try {
    // Kusy v ní zůstanou - jen spadnou do „Bez kategorie" (SetNull v databázi).
    await prisma.technikaKategorie.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE kategorie techniky selhalo:', err);
    return odpovedChyby('chybaApi.smazaniNepodarilo', 500);
  }
}
