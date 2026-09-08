import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';

// Sablony smluv - ciselnik, ktery si admin sam spravuje.
const schema = z.object({
  name: z.string().trim().min(1, 'Vyplňte název šablony.').max(160),
  body: z.string().max(60000).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await requireAdmin();
    if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Neplatná data.' }, { status: 400 });
    }

    const exists = await prisma.contractTemplate.findUnique({ where: { name: parsed.data.name } });
    if (exists) return NextResponse.json({ error: 'Šablona s tímhle názvem už existuje.' }, { status: 409 });

    const last = await prisma.contractTemplate.findFirst({
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });

    const template = await prisma.contractTemplate.create({
      data: {
        name: parsed.data.name,
        body: parsed.data.body ?? '',
        sortOrder: (last?.sortOrder ?? 0) + 10,
      },
    });
    return NextResponse.json(template, { status: 201 });
  } catch (err) {
    console.error('POST /api/admin/contract-templates selhalo:', err);
    const message = err instanceof Error ? err.message : 'Neznámá chyba.';
    return NextResponse.json({ error: `Uložení se nezdařilo (${message}).` }, { status: 500 });
  }
}
