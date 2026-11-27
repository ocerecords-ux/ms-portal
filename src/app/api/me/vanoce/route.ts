import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { nastavVanocePortalu } from '@/lib/vanoceServer';

/**
 * VÁNOČNÍ VÝZDOBA - přepínače (zadání 27. 11. 2026).
 *
 * `uMe` mění VÝHRADNĚ vlastní účet (id ze session, nikdy z těla požadavku).
 * `rezim` přepíná celý portál (podle data / svítit pořád / zhasnout) - a to
 * smí jen Žůžo-labůžo; ostatním se to tiše neprovede, vrátí se 403, ať je
 * vidět proč.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  uMe: z.boolean().optional(),
  rezim: z.enum(['auto', 'vzdy', 'nikdy']).optional(),
});

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Nejste přihlášen.' }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Neplatná data.' }, { status: 400 });
  const { uMe, rezim } = parsed.data;

  try {
    if (uMe !== undefined) {
      await prisma.user.update({
        where: { id: session.user.id },
        // Zaškrtnuté políčko znamená „chci výzdobu", v databázi je opačný
        // příznak „vypnuto" - výchozí stav je totiž svítit.
        data: { vanoceVypnute: !uMe },
      });
    }

    if (rezim !== undefined) {
      if (session.user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Na tohle nemáte právo.' }, { status: 403 });
      }
      await nastavVanocePortalu(rezim, session.user.name ?? null);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('PATCH /api/me/vanoce selhalo:', err);
    return NextResponse.json({ error: 'Uložení se nepodařilo.' }, { status: 500 });
  }
}
