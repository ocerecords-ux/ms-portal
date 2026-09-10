import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';

// Roztrideni jedne firmy z Caflou na klienta / herce (zadani 8. 9. 2026)
// a doplneni chybejiciho e-mailu (zadani 10. 9. 2026: "zarvalo mi to, ze
// nemuze, protoze chybi email... nemuzu ho pak treba v tom bode doplnit
// rucne a projde to?").
const schema = z.object({
  kind: z.enum(['NEZARAZENO', 'KLIENT', 'HEREC', 'IGNOROVAT']).optional(),
  /** E-mail dopsany rucne v tabulce - v Caflou u kontaktu chybi. */
  email: z.string().trim().max(200).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdmin();
    if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Neplatná hodnota.' }, { status: 400 });
    }
    const { kind, email } = parsed.data;

    // E-mail se kontroluje tady, ne az pri prenosu. Preklep by se jinak
    // projevil tim, ze se ucet zalozi a pozvanka tise nikam nedojde.
    if (email !== undefined && email !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      return NextResponse.json({ error: 'Tohle nevypadá jako e-mail.' }, { status: 400 });
    }

    const updated = await prisma.caflouCompany.update({
      where: { id: params.id },
      data: {
        // Rucni volba prebiji odhad - poznamku "podle ceho se to rozhodlo"
        // proto mazeme, uz to neni odhad.
        ...(kind !== undefined ? { kind, kindReason: null } : {}),
        ...(email !== undefined ? { email: email ? email.toLowerCase() : null } : {}),
      },
      select: { id: true, kind: true, email: true },
    });
    return NextResponse.json(updated);
  } catch (err) {
    console.error('PATCH /api/admin/caflou-firmy/[id] selhalo:', err);
    return NextResponse.json({ error: 'Uložení se nezdařilo.' }, { status: 500 });
  }
}
