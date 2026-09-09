import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { buildIcs, type IcsEvent } from '@/lib/ics';
import { canViewCalendar } from '@/lib/roles';

/**
 * Osobní odběr kalendáře (zadani 8. 9. 2026). Odkaz je náhodný, odvolatelný
 * a nese jen to, na co má jeho VLASTNÍK právo — herec svoje termíny, tým
 * Mediaspace kalendář studia. Nikdy nesmí pustit k cizím projektům.
 *
 * Ven jdou jen potvrzené rezervace; výběr a schvalování se dělá v portálu.
 */
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const feed = await prisma.calendarFeed.findUnique({
    where: { token: params.token },
    include: {
      user: { select: { id: true, name: true, email: true, role: true } },
      studio: { select: { id: true, name: true, location: true } },
    },
  });

  if (!feed || feed.revokedAt) {
    return new NextResponse('Odkaz už neplatí.', { status: 404 });
  }

  // Prava se ctou z VLASTNIKA odkazu, ne z odkazu samotneho - kdyz nekomu
  // mezitim skonci role, prestane odkaz vydavat i data.
  const kdo = feed.user;
  const jenSve = feed.scope === 'MINE' || !canViewCalendar(kdo.role);

  const where = jenSve
    ? { state: 'CONFIRMED' as const, request: { actorUserId: kdo.id } }
    : feed.scope === 'STUDIO' && feed.studioId
      ? { state: 'CONFIRMED' as const, studioId: feed.studioId }
      : { state: 'CONFIRMED' as const };

  const slots = await prisma.recordingSlot.findMany({
    where,
    orderBy: { start: 'asc' },
    include: {
      studio: { select: { name: true, location: true } },
      request: { select: { projectName: true, actorName: true } },
    },
  });

  const events: IcsEvent[] = slots.map((s) => ({
    uid: `slot-${s.id}@msportal.cz`,
    start: s.start,
    end: s.end,
    summary: jenSve ? s.request.projectName : `${s.request.projectName} · ${s.request.actorName}`,
    description: `Natáčení — ${s.request.projectName}`,
    location: [s.studio.name, s.studio.location].filter(Boolean).join(', '),
    updatedAt: s.updatedAt,
  }));

  const nazev = jenSve
    ? `MS portal — ${kdo.name || kdo.email}`
    : feed.studio
      ? `MS portal — ${feed.studio.name}`
      : 'MS portal — všechna studia';

  await prisma.calendarFeed.update({ where: { id: feed.id }, data: { lastReadAt: new Date() } });

  return new NextResponse(buildIcs(nazev, events), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="msportal.ics"',
      // Kalendare si stahuji soubor opakovane - at nekesuji stary obsah.
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}
