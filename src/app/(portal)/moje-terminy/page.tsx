import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { releaseExpiredHolds } from '@/lib/calendarServer';
import {
  ACTOR_OPEN_STATUSES,
} from '@/lib/calendar';
import { PridatDoKalendare } from '@/components/PridatDoKalendare';
import { MojeNataceni, type Nataceni } from './MojeNataceni';
import { ProbehlaNataceni, type ProbehleNataceni } from './ProbehlaNataceni';

/**
 * Moje termíny — pohled herce uvnitř portálu (zadani 8. 9. 2026). Přes
 * jednorázový odkaz z e-mailu si termíny vybere i bez účtu; kdo účet má,
 * najde tady všechno pohromadě: co má vybrat, co čeká na potvrzení a co
 * je hotové.
 *
 * Vidí VÝHRADNĚ své nabídky — filtr jde přes actorUserId ze session, nikdy
 * z parametru požadavku.
 */
export const dynamic = 'force-dynamic';

export default async function MojeTerminyPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/login');
  if (session.user.role !== 'HEREC') redirect('/projekty');

  await releaseExpiredHolds();

  const requests = await prisma.recordingRequest.findMany({
    where: { actorUserId: session.user.id, status: { notIn: ['DRAFT', 'PREPARING', 'CANCELLED'] } },
    orderBy: { createdAt: 'desc' },
    include: {
      studio: { select: { name: true, location: true, timezone: true } },
      slots: { orderBy: { start: 'asc' }, include: { studio: { select: { name: true, location: true } } } },
    },
  });

  /**
   * NADCHÁZEJÍCÍ POTVRZENÁ NATÁČENÍ napříč projekty (zadání 19. 9. 2026: „aby
   * viděl své termíny v portálu, když se přihlásí") - s možností přebookovat.
   */
  const mesto = (s: { name: string; location: string | null }) =>
    s.location || (s.name.split(' - ').pop() ?? s.name).replace(/\s+[IVX]+$/, '').trim();
  const nadchazejici: Nataceni[] = requests
    .flatMap((r) =>
      r.slots
        // Drzene (herec vybral, ceka na nas) i potvrzene - u kazdeho svit stav.
        .filter((s) => (s.state === 'CONFIRMED' || s.state === 'SELECTED') && s.end.getTime() > Date.now())
        .map((s) => ({
          id: s.id,
          projekt: r.projectName,
          start: s.start.toISOString(),
          end: s.end.toISOString(),
          mesto: mesto(s.studio),
          // Presne studio (Brno I / Brno II) - herec musi vedet, kam jde.
          studio: (s.studio.name.split(' - ').pop() ?? s.studio.name).trim(),
          potvrzeno: s.state === 'CONFIRMED',
          timezone: r.studio.timezone,
          zadost:
            s.prebookStart && s.prebookEnd
              ? { start: s.prebookStart.toISOString(), end: s.prebookEnd.toISOString() }
              : null,
        })),
    )
    .sort((a, b) => a.start.localeCompare(b.start));

  /**
   * PROBĚHLÁ NATÁČENÍ (zadání 19. 9. 2026: „když ty termíny proběhnou, tak
   * se přiřadí do proběhlá natáčení") - potvrzené a už skončené, nejnovější
   * první. Termín, který herec jen vybral a nikdo ho nepotvrdil, sem nepatří.
   */
  const ted = Date.now();
  const probehle: ProbehleNataceni[] = requests
    .flatMap((r) =>
      r.slots
        .filter((s) => s.state === 'CONFIRMED' && s.end.getTime() <= ted)
        .map((s) => ({
          id: s.id,
          projekt: r.projectName,
          start: s.start.toISOString(),
          end: s.end.toISOString(),
          studio: (s.studio.name.split(' - ').pop() ?? s.studio.name).trim(),
          timezone: r.studio.timezone,
        })),
    )
    .sort((a, b) => b.start.localeCompare(a.start));

  const kVyberu = requests.filter((r) => ACTOR_OPEN_STATUSES.includes(r.status));
  // Odkaz do kalendare (19. 9. 2026) - pres libovolnou nabidku s potvrzenym
  // terminem; herec s uctem v nem dostane vsechny sve potvrzene frekvence.
  const sPotvrzenym = requests.find((r) => r.slots.some((s) => s.state === 'CONFIRMED'));
  const baseUrl = (process.env.NEXTAUTH_URL || 'https://www.msportal.cz').replace(/\/$/, '');


  return (
    <section className="flex flex-col gap-6">
      <div>
        <h1 className="hidden sm:block font-display text-3xl sm:text-4xl text-ink m-0">Moje termíny</h1>
      </div>

      {/* Nahore to, co herce zajima nejvic - kdy a kam jde tocit. */}
      <MojeNataceni terminy={nadchazejici} />

      {sPotvrzenym && (
        <div className="bg-surface rounded-card border border-line shadow-sm p-5 flex flex-col gap-3">
          <p className="text-sm font-body text-ink m-0">Potvrzené natáčení si přidejte do svého kalendáře.</p>
          <PridatDoKalendare url={`${baseUrl}/api/terminy/${sPotvrzenym.accessToken}/kalendar`} />
        </div>
      )}

      {requests.length === 0 && (
        <p className="text-sm font-body text-muted m-0">Zatím pro vás žádné termíny nejsou.</p>
      )}

      {kVyberu.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">
            Čeká na váš výběr
          </h2>
          {kVyberu.map((r) => (
            <Link
              key={r.id}
              href={`/terminy/${r.accessToken}`}
              className="bg-surface rounded-card border-2 border-brand-purple shadow-sm p-5 no-underline flex items-center justify-between gap-4 flex-wrap hover:bg-surfaceSoft transition-colors"
            >
              <span>
                <span className="block font-heading font-semibold text-ink">{r.projectName}</span>
                <span className="block text-sm font-body text-muted mt-0.5">
                  {r.studio.name} · vyberte {r.requiredSessions} z{' '}
                  {r.slots.filter((s) => s.state === 'OFFERED').length} nabídnutých
                </span>
              </span>
              <span className="text-sm font-heading font-semibold text-brand-purple">Vybrat termíny →</span>
            </Link>
          ))}
        </div>
      )}

      <ProbehlaNataceni terminy={probehle} />

      {/* Sekce Ostatní zrušena (19. 9. 2026: „tu tabulku dole ostatní bych dal
          pryč") - termíny jsou nahoře v Moje natáčení. */}
    </section>
  );
}
