import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';
import { defaultLabelsFor } from '@/lib/columnLabels';

// Vlastni nazvy sloupcu v tabulkach (zadani 8. 9. 2026). Meni je jen
// Zuzo-labuzo, primo v tabulce pres tri tecky - stejne jako odkazy v liste.
//
// Uklada se jen to, co se lisi od vychoziho nazvu. Nazev vraceny na vychozi
// se tim padem z databaze rovnou smaze.
const schema = z.object({
  tableKey: z.string().trim().min(1),
  labels: z.record(z.string().trim().max(40)),
});

export async function PUT(req: NextRequest) {
  try {
    const session = await requireAdmin();
    if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Neplatná data.' }, { status: 400 });
    }
    const { tableKey, labels } = parsed.data;

    const defaults = defaultLabelsFor(tableKey);
    if (Object.keys(defaults).length === 0) {
      return NextResponse.json({ error: 'Neznámá tabulka.' }, { status: 400 });
    }

    const toSave: { columnKey: string; label: string }[] = [];
    const toDelete: string[] = [];
    for (const [columnKey, defaultLabel] of Object.entries(defaults)) {
      const value = (labels[columnKey] ?? '').trim();
      if (!value || value === defaultLabel) {
        toDelete.push(columnKey);
      } else {
        toSave.push({ columnKey, label: value });
      }
    }

    await prisma.$transaction([
      prisma.columnLabel.deleteMany({ where: { tableKey, columnKey: { in: toDelete } } }),
      ...toSave.map((item) =>
        prisma.columnLabel.upsert({
          where: { tableKey_columnKey: { tableKey, columnKey: item.columnKey } },
          create: { tableKey, columnKey: item.columnKey, label: item.label },
          update: { label: item.label },
        }),
      ),
    ]);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('PUT /api/admin/column-labels selhalo:', err);
    const message = err instanceof Error ? err.message : 'Neznámá chyba.';
    return NextResponse.json({ error: `Uložení se nezdařilo (${message}).` }, { status: 500 });
  }
}

/** Obnoveni vychozich nazvu - smaze vsechny prepisy tabulky. */
export async function DELETE(req: NextRequest) {
  try {
    const session = await requireAdmin();
    if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

    const tableKey = req.nextUrl.searchParams.get('tableKey');
    if (!tableKey) return NextResponse.json({ error: 'Chybí tabulka.' }, { status: 400 });

    await prisma.columnLabel.deleteMany({ where: { tableKey } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/admin/column-labels selhalo:', err);
    const message = err instanceof Error ? err.message : 'Neznámá chyba.';
    return NextResponse.json({ error: `Obnovení se nezdařilo (${message}).` }, { status: 500 });
  }
}
