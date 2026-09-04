import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';

const schema = z.object({
  name: z.string().trim().min(1, 'Název firmy je povinný.'),
  ratePerPage: z.coerce.number().int().min(0, 'Sazba musí být kladné číslo.'),
  caflouCompanyId: z.string().trim().optional(),
  driveFolderUrl: z.string().trim().optional(),
});

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Neplatná data.' }, { status: 400 });
  }

  const company = await prisma.company.create({
    data: {
      name: parsed.data.name,
      ratePerPage: parsed.data.ratePerPage,
      caflouCompanyId: parsed.data.caflouCompanyId || null,
      driveFolderUrl: parsed.data.driveFolderUrl || null,
    },
  });

  return NextResponse.json(company, { status: 201 });
}
