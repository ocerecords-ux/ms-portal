import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';
import { DEFAULT_BUDGET_SETTINGS } from '@/lib/budget';

// Parametry vypoctu rozpoctu (zadani 6. 9. 2026) - jediny radek v databazi.
const schema = z.object({
  pagesPerSession: z.coerce.number().int().min(1).max(500),
  sessionHours: z.coerce.number().int().min(1).max(24),
  editingCoefficient: z.coerce.number().int().min(0).max(1000),
  bonusPerPage: z.coerce.number().int().min(0).max(10000),
  hourlyRate: z.coerce.number().int().min(0).max(100000),
});

export async function PATCH(req: NextRequest) {
  try {
    const session = await requireAdmin();
    if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Neplatná data.' }, { status: 400 });
    }

    const saved = await prisma.budgetSettings.upsert({
      where: { id: 'default' },
      create: { id: 'default', ...DEFAULT_BUDGET_SETTINGS, ...parsed.data },
      update: parsed.data,
    });
    return NextResponse.json(saved);
  } catch (err) {
    console.error('PATCH /api/admin/budget-settings selhalo:', err);
    const message = err instanceof Error ? err.message : 'Neznámá chyba.';
    return NextResponse.json({ error: `Uložení se nezdařilo (${message}).` }, { status: 500 });
  }
}
