import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';
import { defaultLabelsFor } from '@/lib/columnLabels';

// Nastaveni sloupcu v tabulkach (zadani 8. 9. 2026, rozsireno 9. 9. 2026 na
// poradi a skryvani). Meni je jen Zuzo-labuzo, primo v tabulce pres tri tecky
// - stejne jako odkazy v horni liste.
//
// Uklada se cele nastaveni tabulky (poradi + skryti), ale NAZEV jen tehdy,
// kdyz se lisi od vychoziho. Diky tomu se pozdejsi zmena vychoziho nazvu
// v kodu porad projevi a nezamrzne pod ulozenou kopii.
const schema = z.object({
  tableKey: z.string().trim().min(1),
  columns: z
    .array(
      z.object({
        key: z.string().trim().min(1),
        label: z.string().trim().max(40),
        hidden: z.boolean(),
      }),
    )
    .min(1),
});

export async function PUT(req: NextRequest) {
  try {
    const session = await requireAdmin();
    if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Neplatná data.' }, { status: 400 });
    }
    const { tableKey, columns } = parsed.data;

    const defaults = defaultLabelsFor(tableKey);
    if (Object.keys(defaults).length === 0) {
      return NextResponse.json({ error: 'Neznámá tabulka.' }, { status: 400 });
    }

    // Neznámé klíče ignorujeme a schované sloupce, které chybí v seznamu,
    // doplníme na konec - ať se nastavení nerozbije, když se kód mezitím změní.
    const znamé = columns.filter((c) => c.key in defaults);
    if (znamé.length === 0) {
      return NextResponse.json({ error: 'Žádný známý sloupec.' }, { status: 400 });
    }
    const chybejici = Object.keys(defaults).filter((key) => !znamé.some((c) => c.key === key));
    const vsechny = [
      ...znamé,
      ...chybejici.map((key) => ({ key, label: '', hidden: false })),
    ];

    // Aspoň jeden sloupec musí zůstat vidět - prázdná tabulka nedává smysl.
    if (vsechny.every((c) => c.hidden)) {
      return NextResponse.json({ error: 'Aspoň jeden sloupec musí zůstat zobrazený.' }, { status: 400 });
    }

    await prisma.$transaction([
      prisma.columnLabel.deleteMany({ where: { tableKey } }),
      prisma.columnLabel.createMany({
        data: vsechny.map((c, index) => ({
          tableKey,
          columnKey: c.key,
          // Nezměněný název se neukládá - viz komentář nahoře.
          label: c.label && c.label !== defaults[c.key] ? c.label : '',
          hidden: c.hidden,
          sortOrder: index,
        })),
      }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('PUT /api/admin/column-labels selhalo:', err);
    const message = err instanceof Error ? err.message : 'Neznámá chyba.';
    return NextResponse.json({ error: `Uložení se nezdařilo (${message}).` }, { status: 500 });
  }
}

/** Obnoveni vychozi podoby - smaze cele ulozene nastaveni tabulky. */
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
