import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';

const schema = z.object({
  name: z.string().trim().min(1, 'Název firmy je povinný.'),
  ratePerPage: z.coerce.number().int().min(0, 'Sazba musí být kladné číslo.'),
  caflouTag: z.string().trim().optional(),
  driveFolderUrl: z.string().trim().optional(),
  active: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Neplatná data.' }, { status: 400 });
  }

  const company = await prisma.company.update({
    where: { id: params.id },
    data: {
      name: parsed.data.name,
      ratePerPage: parsed.data.ratePerPage,
      caflouTag: parsed.data.caflouTag || null,
      driveFolderUrl: parsed.data.driveFolderUrl || null,
      ...(parsed.data.active !== undefined ? { active: parsed.data.active } : {}),
    },
  });

  return NextResponse.json(company);
}
