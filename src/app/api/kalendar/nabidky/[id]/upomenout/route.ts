import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { canManageCalendar } from '@/lib/roles';
import { posliUpominkuHerci } from '@/lib/nabidkaTerminuServer';

/**
 * UPOMENUTÍ HERCE, AŤ SI NAKLIKÁ TERMÍNY (připomínka Heleny 2. 10. 2026:
 * „tlačítko na upomenutí herce, aby si naklikal termíny").
 *
 * Záměrně samostatný endpoint a ne příznak u „odeslat": odeslání posílá celou
 * nabídku a přepisuje její stav i čas odeslání, upomínka se stavu nedotkne.
 * Posílat se dá opakovaně - v historii nabídky je vidět kdy a od koho.
 */
const schema = z.object({ vzkaz: z.string().trim().max(500).optional() });

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !canManageCalendar(session.user.role)) {
      return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
    }

    // Telo je nepovinne - tlacitko v seznamu nabidek posila prazdny POST.
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Vzkaz je moc dlouhý.' }, { status: 400 });
    }

    const vysledek = await posliUpominkuHerci(
      params.id,
      { id: session.user.id, label: session.user.name || session.user.email },
      parsed.data.vzkaz,
    );
    if ('error' in vysledek) {
      return NextResponse.json({ error: vysledek.error }, { status: vysledek.status });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('POST /api/kalendar/nabidky/[id]/upomenout selhalo:', err);
    const message = err instanceof Error ? err.message : 'Neznámá chyba.';
    return NextResponse.json({ error: `Upomínku se nepodařilo poslat (${message}).` }, { status: 500 });
  }
}
