import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';

/** Úprava a vyřazení jednoho kusu techniky (22. 10. 2026) - viz ../route.ts. */
export const dynamic = 'force-dynamic';

const schema = z.object({
  nazev: z.string().trim().min(1).max(200).optional(),
  kategorieId: z.string().trim().min(1).nullable().optional(),
  vyrobce: z.string().trim().max(120).nullable().optional(),
  model: z.string().trim().max(120).nullable().optional(),
  serioveCislo: z.string().trim().max(120).nullable().optional(),
  studioId: z.string().trim().min(1).nullable().optional(),
  poznamka: z.string().trim().max(4000).nullable().optional(),
  foto: z.string().trim().max(3_000_000).nullable().optional(),
  vyrazeno: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Neplatná data.' }, { status: 400 });
  const d = parsed.data;

  try {
    await prisma.technika.update({
      where: { id: params.id },
      data: {
        ...(d.nazev !== undefined ? { nazev: d.nazev } : {}),
        ...(d.kategorieId !== undefined ? { kategorieId: d.kategorieId } : {}),
        ...(d.vyrobce !== undefined ? { vyrobce: d.vyrobce || null } : {}),
        ...(d.model !== undefined ? { model: d.model || null } : {}),
        ...(d.serioveCislo !== undefined ? { serioveCislo: d.serioveCislo || null } : {}),
        ...(d.studioId !== undefined ? { studioId: d.studioId } : {}),
        ...(d.poznamka !== undefined ? { poznamka: d.poznamka || null } : {}),
        ...(d.foto !== undefined ? { foto: d.foto || null } : {}),
        ...(d.vyrazeno !== undefined ? { vyrazeno: d.vyrazeno } : {}),
      },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('PATCH /api/admin/technika/[id] selhalo:', err);
    return NextResponse.json({ error: 'Uložení se nepodařilo.' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

  try {
    await prisma.technika.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/admin/technika/[id] selhalo:', err);
    return NextResponse.json({ error: 'Smazání se nepodařilo.' }, { status: 500 });
  }
}
