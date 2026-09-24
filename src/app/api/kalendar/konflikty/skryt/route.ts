import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { canViewCalendar } from '@/lib/roles';
import { skryjKonflikt, vratKonflikt } from '@/lib/konfliktyServer';

/**
 * ZÁMĚRNÝ KONFLIKT (zadání 24. 9. 2026: „měl bych mít možnost někdy zrušit
 * daný konflikt v kalendáři, někdy to může být záměr").
 *
 * POST konflikt skryje, DELETE ho vrátí. Klíč nese i čas překryvu, takže
 * jakmile se některá z událostí posune, upozornění se vrátí samo - viz
 * lib/konfliktyServer.ts.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  klic: z.string().trim().min(1).max(400),
  druh: z.enum(['MOJE', 'PROVOZ']),
  popis: z.string().trim().max(300).default(''),
  duvod: z.string().trim().max(300).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !canViewCalendar(session.user.role)) {
      return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
    }

    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'Neplatná data.' }, { status: 400 });

    await skryjKonflikt(parsed.data, {
      id: session.user.id,
      jmeno: session.user.name || session.user.email || 'neznámý',
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('POST /api/kalendar/konflikty/skryt selhalo:', err);
    return NextResponse.json({ error: 'Nepodařilo se uložit.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !canViewCalendar(session.user.role)) {
      return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
    }

    const klic = new URL(req.url).searchParams.get('klic') ?? '';
    if (!klic) return NextResponse.json({ error: 'Chybí klíč.' }, { status: 400 });

    await vratKonflikt(klic);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/kalendar/konflikty/skryt selhalo:', err);
    return NextResponse.json({ error: 'Nepodařilo se vrátit.' }, { status: 500 });
  }
}
