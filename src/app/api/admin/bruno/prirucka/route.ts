import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';

/**
 * Uložení příručky pro Bruna (zadání 16. 9. 2026). Jeden řádek s id
 * „default" — viz lib/brunoPrirucka.ts.
 *
 * Píše ji jen Žůžo-labůžo. Je to text, který Brunovi platí víc než chat,
 * takže kdo do něj smí psát, tomu Bruno v podstatě mění pravidla — to není
 * nic, co by mělo jít odkudkoliv jinud.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  // Strop je vysoko schválně: příručka je celý text zadání pro model a
  // zkrácená by ztratila smysl. Přes 20 000 znaků už to ale nikdo nepíše
  // ručně a byl by to spíš omyl (vložený PDF, celý chat).
  text: z.string().trim().min(1, 'Příručka nesmí být prázdná.').max(20_000),
});

export async function PUT(req: NextRequest) {
  try {
    const session = await requireAdmin();
    if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Neplatná data.' },
        { status: 400 },
      );
    }

    const kdo = session.user.name || session.user.email || null;
    await prisma.brunoPrirucka.upsert({
      where: { id: 'default' },
      create: { id: 'default', text: parsed.data.text, updatedBy: kdo },
      update: { text: parsed.data.text, updatedBy: kdo },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('PUT /api/admin/bruno/prirucka selhalo:', err);
    return NextResponse.json({ error: 'Uložení se nezdařilo.' }, { status: 500 });
  }
}
