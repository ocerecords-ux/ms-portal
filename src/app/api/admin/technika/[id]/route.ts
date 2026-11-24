import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireTechniku, smiDoStudia } from '@/lib/technikaPristup';
import { odpovedChyby } from '@/lib/chybyApi';

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
  const pristup = await requireTechniku();
  if (!pristup) return odpovedChyby('chybaApi.bezOpravneni', 403);

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return odpovedChyby('chybaApi.neplatnaData', 400);
  const d = parsed.data;

  /**
   * VEDOUCÍ POBOČKY SAHÁ JEN NA SVOU POBOČKU (24. 11. 2026). Musí sedět OBOJÍ:
   * kde kus stojí teď a kam ho ukládá - jinak by si cizí mikrofon přestěhoval
   * k sobě, nebo svůj odsunul tam, kam už nevidí.
   */
  const ted = await prisma.technika
    .findUnique({ where: { id: params.id }, select: { studioId: true } })
    .catch(() => null);
  if (!ted) return odpovedChyby('chybaApi.kusNenalezen', 404);
  if (!smiDoStudia(pristup, ted.studioId)) return odpovedChyby('chybaApi.bezOpravneni', 403);
  if (d.studioId !== undefined && !smiDoStudia(pristup, d.studioId)) {
    return odpovedChyby('chybaApi.bezOpravneni', 403);
  }

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
    return odpovedChyby('chybaApi.ulozeniNepodarilo', 500);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const pristup = await requireTechniku();
  if (!pristup) return odpovedChyby('chybaApi.bezOpravneni', 403);

  const ted = await prisma.technika
    .findUnique({ where: { id: params.id }, select: { studioId: true } })
    .catch(() => null);
  if (!ted) return odpovedChyby('chybaApi.kusNenalezen', 404);
  if (!smiDoStudia(pristup, ted.studioId)) return odpovedChyby('chybaApi.bezOpravneni', 403);

  try {
    await prisma.technika.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/admin/technika/[id] selhalo:', err);
    return odpovedChyby('chybaApi.smazaniNepodarilo', 500);
  }
}
