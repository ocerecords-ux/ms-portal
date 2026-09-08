import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { canManageCalendar, canViewCalendar } from '@/lib/roles';
import { loadOccupancy, loadStudios, releaseExpiredHolds } from '@/lib/calendarServer';
import {
  BLOCK_KIND_LABELS,
  GRID_END_HOUR,
  GRID_START_HOUR,
  addDays,
  startOfMonth,
  startOfWeek,
  utcParts,
  zonedToUtc,
  type CalendarView,
} from '@/lib/calendar';
import { CalendarBrowser, type CalendarEvent, type CalendarDay } from './CalendarBrowser';

/**
 * Kalendář studií (zadani 8. 9. 2026). Den / týden / měsíc, jedno studio
 * najednou — studia jsou samostatné kalendářové zdroje.
 *
 * Vidí ho tým Mediaspace: Produkce a Žůžo-labůžo i zapisují, zvukař jen čte.
 * Herec má vlastní, užší pohled (/moje-terminy) — sem nesmí.
 */
export const dynamic = 'force-dynamic';

function parseView(value?: string): CalendarView {
  return value === 'den' || value === 'mesic' ? value : 'tyden';
}

function parseDate(value?: string): Date {
  if (value) {
    const d = new Date(`${value}T12:00:00.000Z`);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

export default async function KalendarPage({
  searchParams,
}: {
  searchParams: { studio?: string; pohled?: string; datum?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session || !canViewCalendar(session.user.role)) redirect('/projekty');

  // Termíny, které herec vybral a produkce je včas nepotvrdila, se vrací do
  // nabídky. Vercel nemá nic, co by běželo samo, tak se to dělá tady.
  await releaseExpiredHolds();

  const studios = await loadStudios();
  if (studios.length === 0) {
    return (
      <section className="flex flex-col gap-4">
        <h1 className="font-display text-3xl sm:text-4xl text-ink m-0">Kalendář</h1>
        <p className="text-sm font-body text-muted m-0">
          Zatím tu není žádné studio. Studia se zakládají v administraci.
        </p>
      </section>
    );
  }

  const studio = studios.find((s) => s.id === searchParams?.studio) ?? studios[0];
  const view = parseView(searchParams?.pohled);
  const anchor = parseDate(searchParams?.datum);
  const tz = studio.timezone;

  // Rozsah se počítá v pásmu STUDIA - v Londýně začíná den o hodinu jinde.
  const anchorParts = utcParts(anchor, tz);
  const anchorLocal = new Date(anchorParts.year, anchorParts.month - 1, anchorParts.day);

  let firstLocal: Date;
  let dayCount: number;
  if (view === 'den') {
    firstLocal = anchorLocal;
    dayCount = 1;
  } else if (view === 'tyden') {
    firstLocal = startOfWeek(anchorLocal);
    dayCount = 7;
  } else {
    firstLocal = startOfWeek(startOfMonth(anchorLocal));
    dayCount = 42; // šest týdnů, ať měsíc vždycky vyjde celý
  }

  const days: CalendarDay[] = [];
  for (let i = 0; i < dayCount; i++) {
    const d = addDays(firstLocal, i);
    const start = zonedToUtc(d.getFullYear(), d.getMonth() + 1, d.getDate(), 0, tz);
    const end = zonedToUtc(d.getFullYear(), d.getMonth() + 1, d.getDate() + 1, 0, tz);
    const weekday = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getDay();
    const pravidlo = studio.hours.find((h) => h.weekday === weekday);
    days.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
      startIso: start.toISOString(),
      endIso: end.toISOString(),
      inMonth: d.getMonth() === anchorLocal.getMonth(),
      byArrangement: pravidlo?.byArrangement ?? false,
      openFrom: pravidlo?.startMinutes ?? null,
      openTo: pravidlo?.endMinutes ?? null,
    });
  }

  const from = new Date(days[0].startIso);
  const to = new Date(days[days.length - 1].endIso);

  // includeOffered: nabídnutá okna nezabírají studio, ale produkce je vidět chce.
  const occupancy = await loadOccupancy([studio.id], from, to, { includeOffered: true });

  const events: CalendarEvent[] = [
    ...occupancy.slots.map((s) => ({
      id: s.id,
      kind: 'SLOT' as const,
      start: s.start.toISOString(),
      end: s.end.toISOString(),
      state: s.state,
      title: s.label,
      href: `/kalendar/nabidka/${s.requestId}`,
    })),
    ...occupancy.blocks.map((b) => ({
      id: b.id,
      kind: 'BLOCK' as const,
      start: b.start.toISOString(),
      end: b.end.toISOString(),
      state: b.kind,
      title: b.title,
      subtitle: BLOCK_KIND_LABELS[b.kind] ?? 'Blokace',
    })),
  ];

  return (
    <CalendarBrowser
      studios={studios.map((s) => ({ id: s.id, shortName: s.shortName, name: s.name, timezone: s.timezone }))}
      studioId={studio.id}
      timezone={tz}
      view={view}
      anchorIso={anchorLocal.toISOString().slice(0, 10)}
      days={days}
      events={events}
      gridStartHour={GRID_START_HOUR}
      gridEndHour={GRID_END_HOUR}
      canManage={canManageCalendar(session.user.role)}
    />
  );
}
