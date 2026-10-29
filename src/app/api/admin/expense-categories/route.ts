import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';
import { odpovedChyby, odpovedChybyS } from '@/lib/chybyApi';

// Kategorie vydaju - ciselnik, ktery si admin sam rozsiruje (zadani 8. 9. 2026).
const schema = z.object({
  name: z.string().trim().min(1, 'Vyplňte název kategorie.').max(80),
});

export async function POST(req: NextRequest) {
  try {
    const session = await requireAdmin();
    if (!session) return odpovedChyby('chybaApi.bezOpravneni', 403);

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Neplatná data.' }, { status: 400 });
    }

    const exists = await prisma.expenseCategory.findUnique({ where: { name: parsed.data.name } });
    if (exists) {
      return odpovedChyby('chybaApi.kategorieUzExistuje', 409);
    }

    const last = await prisma.expenseCategory.findFirst({
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });

    const category = await prisma.expenseCategory.create({
      data: { name: parsed.data.name, sortOrder: (last?.sortOrder ?? 0) + 10 },
    });

    return NextResponse.json(category, { status: 201 });
  } catch (err) {
    console.error('POST /api/admin/expense-categories selhalo:', err);
    const message = err instanceof Error ? err.message : 'Neznámá chyba.';
    return odpovedChybyS('chybaApi.ulozeniNezdariloS', { zprava: message }, 500);
  }
}
