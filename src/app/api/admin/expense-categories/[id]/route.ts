import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';

// Prejmenovani, vyrazeni a smazani kategorie vydaju.
const schema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  active: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdmin();
    if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Neplatná data.' }, { status: 400 });
    }

    const category = await prisma.expenseCategory.update({ where: { id: params.id }, data: parsed.data });
    return NextResponse.json(category);
  } catch (err) {
    console.error('PATCH /api/admin/expense-categories/[id] selhalo:', err);
    const message = err instanceof Error ? err.message : 'Neznámá chyba.';
    return NextResponse.json({ error: `Uložení se nezdařilo (${message}).` }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdmin();
    if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

    // Kategorii, ktera uz je na dokladech, nemazeme - jen ji vyradime z
    // nabidky, aby stare doklady zustaly zarazene.
    const used = await prisma.expense.count({ where: { categoryId: params.id } });
    if (used > 0) {
      await prisma.expenseCategory.update({ where: { id: params.id }, data: { active: false } });
      return NextResponse.json({ ok: true, deactivatedInsteadOfDeleted: true, usedByExpenses: used });
    }

    await prisma.expenseCategory.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/admin/expense-categories/[id] selhalo:', err);
    const message = err instanceof Error ? err.message : 'Neznámá chyba.';
    return NextResponse.json({ error: `Smazání se nezdařilo (${message}).` }, { status: 500 });
  }
}
