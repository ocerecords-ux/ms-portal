import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canViewCalendar } from '@/lib/roles';
import { BLOCK_KIND_LABELS } from '@/lib/calendar';

/**
 * HLEDÁNÍ V CELÉM KALENDÁŘI (zadání 20. 9. 2026: „ještě bychom mohli udělat
 * v tom kalendáři sofistikovanější hledání, třeba aby našel všechny události
 * podle projektu, herce, zvukaře a ukázal jejich seznam. Seznam výskytů").
 *
 * Políčko nad kalendářem do teď jen filtrovalo zobrazený týden - co bylo
 * minulý měsíc nebo bude za tři týdny, nenašlo. Tohle prohledá VŠECHNY
 * termíny a události studia napříč časem a vrátí seznam výskytů: kdy, kde,
 * co to bylo a s kým.
 *
 * Hledá se v názvu projektu, jménu herce, jménu zvukaře i v popisu události,
 * bez ohledu na velikost písmen. Diakritika se nepřeskakuje - hledat „silda"
 * místo „Šildová" umí až databáze s rozšířením, které nemáme.
 */
export const dynamic = 'force-dynamic';

/** Kolik výskytů se vrátí nejvýš - do seznamu se stejně víc nevejde. */
const NEJVIC = 120;

export type VyskytKalendare = {
  id: string;
  kind: 'SLOT' | 'BLOCK';
  start: string;
  end: string;
  /** Den v pásmu studia - na něj se v kalendáři skáče. */
  den: string;
  studioId: string;
  studioName: string;
  color: string;
  druh: string;
  projectName: string | null;
  actorName: string | null;
  zvukarName: string | null;
  /** Kdo z hledaných polí se trefil - aby bylo vidět proč. */
  proc: string[];
};

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !canViewCalendar(session.user.role)) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }

  const q = (new URL(req.url).searchParams.get('q') ?? '').trim();
  if (q.length < 2) return NextResponse.json({ vyskyty: [], celkem: 0 });

  try {
    const obsahuje = { contains: q, mode: 'insensitive' as const };
    const [sloty, bloky, studia] = await Promise.all([
      prisma.recordingSlot.findMany({
        where: {
          state: { in: ['SELECTED', 'CONFIRMED'] },
          OR: [
            { zvukarName: obsahuje },
            { request: { is: { projectName: obsahuje } } },
            { request: { is: { actorName: obsahuje } } },
          ],
        },
        orderBy: { start: 'desc' },
        take: NEJVIC,
        select: {
          id: true,
          start: true,
          end: true,
          state: true,
          studioId: true,
          zvukarName: true,
          request: { select: { projectName: true, actorName: true } },
        },
      }),
      prisma.studioBlock.findMany({
        where: {
          OR: [{ title: obsahuje }, { projectName: obsahuje }, { actorName: obsahuje }, { zvukarName: obsahuje }],
        },
        orderBy: { start: 'desc' },
        take: NEJVIC,
        select: {
          id: true,
          start: true,
          end: true,
          kind: true,
          studioId: true,
          title: true,
          projectName: true,
          actorName: true,
          zvukarName: true,
        },
      }),
      prisma.studio.findMany({ select: { id: true, name: true, shortName: true, color: true, timezone: true } }),
    ]);

    const studioPodleId = new Map(studia.map((s) => [s.id, s]));
    const kratce = (id: string) => {
      const s = studioPodleId.get(id);
      if (!s) return '';
      return (s.shortName ?? s.name.split(' - ').pop() ?? s.name).trim();
    };
    const den = (d: Date, studioId: string) =>
      new Intl.DateTimeFormat('en-CA', {
        timeZone: studioPodleId.get(studioId)?.timezone ?? 'Europe/Prague',
      }).format(d);

    const male = q.toLowerCase();
    const proc = (pole: Record<string, string | null | undefined>) =>
      Object.entries(pole)
        .filter(([, v]) => (v ?? '').toLowerCase().includes(male))
        .map(([k]) => k);

    const vyskyty: VyskytKalendare[] = [
      ...sloty.map((s) => ({
        id: s.id,
        kind: 'SLOT' as const,
        start: s.start.toISOString(),
        end: s.end.toISOString(),
        den: den(s.start, s.studioId),
        studioId: s.studioId,
        studioName: kratce(s.studioId),
        color: studioPodleId.get(s.studioId)?.color ?? '#7B55FF',
        druh: s.state === 'CONFIRMED' ? 'Natáčení' : 'Drženo hercem',
        projectName: s.request.projectName,
        actorName: s.request.actorName,
        zvukarName: s.zvukarName,
        proc: proc({
          projekt: s.request.projectName,
          herec: s.request.actorName,
          zvukař: s.zvukarName,
        }),
      })),
      ...bloky.map((b) => ({
        id: b.id,
        kind: 'BLOCK' as const,
        start: b.start.toISOString(),
        end: b.end.toISOString(),
        den: den(b.start, b.studioId),
        studioId: b.studioId,
        studioName: kratce(b.studioId),
        color: studioPodleId.get(b.studioId)?.color ?? '#7B55FF',
        druh: BLOCK_KIND_LABELS[b.kind] ?? 'Blokace',
        projectName: b.projectName ?? b.title,
        actorName: b.actorName,
        zvukarName: b.zvukarName,
        proc: proc({
          projekt: b.projectName ?? b.title,
          herec: b.actorName,
          zvukař: b.zvukarName,
        }),
      })),
    ].sort((a, b) => (a.start < b.start ? 1 : -1));

    return NextResponse.json({ vyskyty: vyskyty.slice(0, NEJVIC), celkem: vyskyty.length });
  } catch (err) {
    console.error('GET /api/kalendar/hledani selhalo:', err);
    return NextResponse.json({ error: 'Hledání se nepodařilo.' }, { status: 500 });
  }
}
