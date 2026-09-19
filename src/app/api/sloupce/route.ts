import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { defaultLabelsFor } from '@/lib/columnLabels';
import { jeZarizeni } from '@/lib/zarizeni';

/**
 * Vlastní sloupce tabulky - každý sám za sebe, zvlášť pro počítač a mobil
 * (zadání 19. 9. 2026: „a taky to, jaké se mi zobrazují sloupce v přehledu
 * projektu"). Ukládá se jen pořadí a co je vidět; názvy sloupců jsou
 * společné a mění je Žůžo-labůžo přes /api/admin/column-labels.
 */
const schema = z.object({
  tableKey: z.string().trim().min(1),
  zarizeni: z.enum(['POCITAC', 'MOBIL']),
  columns: z.array(z.object({ key: z.string().trim().min(1), hidden: z.boolean() })).min(1),
});

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'Nejste přihlášeni.' }, { status: 401 });

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Neplatná data.' }, { status: 400 });
    }
    const { tableKey, zarizeni, columns } = parsed.data;

    const znameKlice = Object.keys(defaultLabelsFor(tableKey));
    if (znameKlice.length === 0) return NextResponse.json({ error: 'Neznámá tabulka.' }, { status: 400 });

    const znamé = columns.filter((c) => znameKlice.includes(c.key));
    if (!znamé.some((c) => !c.hidden)) {
      return NextResponse.json({ error: 'Aspoň jeden sloupec musí zůstat zobrazený.' }, { status: 400 });
    }

    await prisma.$transaction([
      prisma.userColumnSetting.deleteMany({ where: { userId: session.user.id, tableKey, zarizeni } }),
      prisma.userColumnSetting.createMany({
        data: znamé.map((c, index) => ({
          userId: session.user.id,
          tableKey,
          zarizeni,
          columnKey: c.key,
          sortOrder: index,
          hidden: c.hidden,
        })),
      }),
    ]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('PUT /api/sloupce selhalo:', err);
    const message = err instanceof Error ? err.message : 'Neznámá chyba.';
    return NextResponse.json({ error: `Uložení se nezdařilo (${message}).` }, { status: 500 });
  }
}

/** Zpět na výchozí sloupce pro jedno zařízení. */
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'Nejste přihlášeni.' }, { status: 401 });

    const tableKey = req.nextUrl.searchParams.get('tableKey');
    const zarizeni = req.nextUrl.searchParams.get('zarizeni');
    if (!tableKey || !jeZarizeni(zarizeni)) {
      return NextResponse.json({ error: 'Chybí tabulka nebo zařízení.' }, { status: 400 });
    }
    await prisma.userColumnSetting.deleteMany({ where: { userId: session.user.id, tableKey, zarizeni } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/sloupce selhalo:', err);
    return NextResponse.json({ error: 'Obnovení se nezdařilo.' }, { status: 500 });
  }
}
