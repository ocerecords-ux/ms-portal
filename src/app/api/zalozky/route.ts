import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

/**
 * VLASTNÍ POŘADÍ ZÁLOŽEK (zadání 29. 9. 2026). Každý sám za sebe - nikdo tím
 * nemění lištu ostatním, takže se tu neřeší role: stačí být přihlášený.
 *
 * Ukládá se celé pořadí naráz. Lišta má pár položek a přesun jedné znamená
 * přepsat pořadí stejně, takže jeden upsert je jednodušší než počítat rozdíly.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  sekce: z.string().trim().min(1).max(60),
  /** Prázdné pole = zpátky na výchozí pořadí z kódu. */
  poradi: z.array(z.string().trim().min(1).max(120)).max(40),
});

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'Nejste přihlášeni.' }, { status: 401 });

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: 'Neplatná data.' }, { status: 400 });
    const { sekce, poradi } = parsed.data;

    await prisma.userZalozky.upsert({
      where: { userId_sekce: { userId: session.user.id, sekce } },
      update: { poradi },
      create: { userId: session.user.id, sekce, poradi },
    });

    return NextResponse.json({ ulozeno: true });
  } catch (err) {
    console.error('PUT /api/zalozky selhalo:', err);
    return NextResponse.json({ error: 'Pořadí se nepodařilo uložit.' }, { status: 500 });
  }
}
