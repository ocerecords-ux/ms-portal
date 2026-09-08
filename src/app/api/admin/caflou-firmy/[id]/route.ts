import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';

// Roztrideni jedne firmy z Caflou na klienta / herce (zadani 8. 9. 2026).
const schema = z.object({ kind: z.enum(['NEZARAZENO', 'KLIENT', 'HEREC', 'IGNOROVAT']) });

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdmin();
    if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Neplatná hodnota.' }, { status: 400 });
    }

    const updated = await prisma.caflouCompany.update({
      where: { id: params.id },
      // Rucni volba prebiji odhad - poznamku "podle ceho se to rozhodlo"
      // proto mazeme, uz to neni odhad.
      data: { kind: parsed.data.kind, kindReason: null },
      select: { id: true, kind: true },
    });
    return NextResponse.json(updated);
  } catch (err) {
    console.error('PATCH /api/admin/caflou-firmy/[id] selhalo:', err);
    return NextResponse.json({ error: 'Uložení se nezdařilo.' }, { status: 500 });
  }
}
