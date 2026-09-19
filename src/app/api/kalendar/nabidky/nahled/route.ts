import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { canManageCalendar } from '@/lib/roles';
import { loadCalendarSettings } from '@/lib/calendarServer';
import { volnaMistaProParametry } from '@/lib/volnaMistaServer';

/**
 * Náhled volných míst v okně „Vytvořit nabídku termínů" (zadání 19. 9. 2026:
 * „nelíbí se mi, jak je to plánování na dva kroky… vše by mohlo být
 * přehledně v jednom okně"). Nic neukládá - jen spočítá, co by herec
 * dostal, když produkce změní studia, období nebo herce.
 */
const schema = z.object({
  actorUserId: z.string().trim().optional(),
  studioIds: z.array(z.string().trim().min(1)).min(1).max(20),
  periodFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !canManageCalendar(session.user.role)) {
      return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
    }
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'Neplatná data.' }, { status: 400 });
    const d = parsed.data;
    if (d.periodTo < d.periodFrom) return NextResponse.json({ pocet: 0, mista: [] });

    const settings = await loadCalendarSettings();
    const { volna, studia } = await volnaMistaProParametry({
      studioId: d.studioIds[0],
      studioIds: d.studioIds,
      actorUserId: d.actorUserId || null,
      od: d.periodFrom,
      doo: d.periodTo,
      sessionMinutes: settings.sessionHours * 60,
    });
    const nazvy = new Map(studia.map((s) => [s.id, s.name]));
    const tz = new Map(studia.map((s) => [s.id, s.timezone]));

    return NextResponse.json({
      pocet: volna.length,
      mista: volna.map((m) => ({
        studio: nazvy.get(m.studioId) ?? '',
        timezone: tz.get(m.studioId) ?? 'Europe/Prague',
        start: m.start.toISOString(),
        end: m.end.toISOString(),
        vikend: m.poDomluve,
      })),
    });
  } catch (err) {
    console.error('POST /api/kalendar/nabidky/nahled selhalo:', err);
    return NextResponse.json({ error: 'Náhled se nepodařilo spočítat.' }, { status: 500 });
  }
}
