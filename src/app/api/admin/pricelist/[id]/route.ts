import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';
import { withVat } from '@/lib/priceList';

const schema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  priceExVat: z.string().trim().optional(),
  priceIncVat: z.string().trim().optional(),
  active: z.boolean().optional(),
});

function toIntOrNull(v?: string): number | null {
  if (!v) return null;
  const n = parseInt(v.replace(/\s/g, ''), 10);
  return Number.isFinite(n) ? n : null;
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdmin();
    if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Neplatná data.' }, { status: 400 });
    }
    const data = parsed.data;

    const item = await prisma.priceListItem.findUnique({ where: { id: params.id } });
    if (!item) return NextResponse.json({ error: 'Položka nenalezena.' }, { status: 404 });

    if (data.name && data.name !== item.name) {
      const taken = await prisma.priceListItem.findUnique({ where: { name: data.name } });
      if (taken) return NextResponse.json({ error: 'Položka s tímto názvem už v ceníku je.' }, { status: 409 });
    }

    const priceExVat = data.priceExVat !== undefined ? toIntOrNull(data.priceExVat) : undefined;
    let priceIncVat = data.priceIncVat !== undefined ? toIntOrNull(data.priceIncVat) : undefined;
    if (priceIncVat === null && priceExVat != null) priceIncVat = withVat(priceExVat);

    const updated = await prisma.priceListItem.update({
      where: { id: params.id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(priceExVat !== undefined ? { priceExVat } : {}),
        ...(priceIncVat !== undefined ? { priceIncVat } : {}),
        ...(data.active !== undefined ? { active: data.active } : {}),
      },
    });

    // Kdyz se polozka prejmenuje, prejmenujeme i typ projektu u projektu,
    // ktere ji uz maji prirazenou - jinak by v nich zustal starý nazev.
    if (data.name && data.name !== item.name) {
      await prisma.projectMeta.updateMany({
        where: { projectType: item.name },
        data: { projectType: data.name },
      });
    }

    return NextResponse.json(updated);
  } catch (err) {
    console.error('PATCH /api/admin/pricelist/[id] selhalo:', err);
    const message = err instanceof Error ? err.message : 'Neznámá chyba.';
    return NextResponse.json({ error: `Uložení se nezdařilo (${message}).` }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdmin();
    if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

    const item = await prisma.priceListItem.findUnique({ where: { id: params.id } });
    if (!item) return NextResponse.json({ error: 'Položka nenalezena.' }, { status: 404 });

    // Polozku, kterou uz nekdo pouzil jako typ projektu, radeji nemazeme -
    // jen ji vyradime, at se u historickych projektu typ neztrati.
    const used = await prisma.projectMeta.count({ where: { projectType: item.name } });
    if (used > 0) {
      const updated = await prisma.priceListItem.update({ where: { id: params.id }, data: { active: false } });
      return NextResponse.json({ ...updated, deactivatedInsteadOfDeleted: true, usedByProjects: used });
    }

    await prisma.priceListItem.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/admin/pricelist/[id] selhalo:', err);
    const message = err instanceof Error ? err.message : 'Neznámá chyba.';
    return NextResponse.json({ error: `Smazání se nezdařilo (${message}).` }, { status: 500 });
  }
}
