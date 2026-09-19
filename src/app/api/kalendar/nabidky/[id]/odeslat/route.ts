import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { canManageCalendar } from '@/lib/roles';
import { odesliNabidkuHerci } from '@/lib/nabidkaTerminuServer';

// Odeslani nabidky herci. Nabidka musi obsahovat aspon tolik terminu, kolik
// jich ma herec vybrat - jinak nema z ceho vybirat.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !canManageCalendar(session.user.role)) {
      return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
    }

    const vysledek = await odesliNabidkuHerci(params.id, {
      id: session.user.id,
      label: session.user.name || session.user.email,
    });
    if ('error' in vysledek) {
      return NextResponse.json({ error: vysledek.error }, { status: vysledek.status });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('POST /api/kalendar/nabidky/[id]/odeslat selhalo:', err);
    const message = err instanceof Error ? err.message : 'Neznámá chyba.';
    return NextResponse.json({ error: `Odeslání se nezdařilo (${message}).` }, { status: 500 });
  }
}
