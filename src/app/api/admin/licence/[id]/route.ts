import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';
import { jeKlicIkony } from '@/lib/ikonyTypu';

/** Úprava a smazání druhu licence (zadání 18. 9. 2026). */
export const dynamic = 'force-dynamic';

const schema = z.object({
  nazev: z.string().trim().min(1).max(60).optional(),
  /** Prázdný řetězec = žádná ikona. */
  ikona: z.string().trim().optional(),
  poradi: z.number().int().optional(),
  active: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Neplatná data.' }, { status: 400 });
  const d = parsed.data;

  try {
    const druh = await prisma.druhLicence.update({
      where: { id: params.id },
      data: {
        ...(d.nazev !== undefined ? { nazev: d.nazev } : {}),
        ...(d.ikona !== undefined ? { ikona: d.ikona && jeKlicIkony(d.ikona) ? d.ikona : null } : {}),
        ...(d.poradi !== undefined ? { poradi: d.poradi } : {}),
        ...(d.active !== undefined ? { active: d.active } : {}),
      },
    });
    return NextResponse.json({ druh });
  } catch (err) {
    console.error('PATCH /api/admin/licence selhalo:', err);
    return NextResponse.json({ error: 'Změnu se nepodařilo uložit.' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

  // Druh, který je u nějakého projektu zaškrtnutý, se nemaže - jinak by
  // z projektu zmizel údaj, který tam někdo vědomě dal. Takový se vyřadí
  // (active = false) a přestane se nabízet u nových.
  const pocet = await prisma.projectMeta.count({ where: { licence: { some: { id: params.id } } } });
  if (pocet > 0) {
    await prisma.druhLicence.update({ where: { id: params.id }, data: { active: false } });
    return NextResponse.json({ vyrazeno: true, projektu: pocet });
  }

  await prisma.druhLicence.delete({ where: { id: params.id } });
  return NextResponse.json({ smazano: true });
}
