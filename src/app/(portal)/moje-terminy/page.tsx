import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { releaseExpiredHolds } from '@/lib/calendarServer';
import {
  ACTOR_OPEN_STATUSES,
  RECORDING_STATUS_CLASSES,
  RECORDING_STATUS_LABELS,
  minutesInZone,
  minutesToTime,
} from '@/lib/calendar';

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
      slots: { orderBy: { start: 'asc' } },
    },
  });

  const kVyberu = requests.filter((r) => ACTOR_OPEN_STATUSES.includes(r.status));
  const ostatni = requests.filter((r) => !ACTOR_OPEN_STATUSES.includes(r.status));

  function popisSlotu(start: Date, end: Date, tz: string): string {
    const den = new Intl.DateTimeFormat('cs-CZ', {
      timeZone: tz,
      weekday: 'long',
      day: 'numeric',
      month: 'numeric',
    }).format(start);
    return `${den} · ${minutesToTime(minutesInZone(start, tz))}–${minutesToTime(minutesInZone(end, tz))}`;
  }

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl sm:text-4xl text-ink m-0">Moje termíny</h1>
      </div>

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

      {ostatni.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">Ostatní</h2>
          {ostatni.map((r) => {
            const dulezite = r.slots.filter((s) => s.state === 'CONFIRMED' || s.state === 'SELECTED');
            return (
              <div key={r.id} className="bg-surface rounded-card border border-line shadow-sm p-5 flex flex-col gap-2">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <span>
                    <span className="block font-heading font-semibold text-ink">{r.projectName}</span>
                    <span className="block text-sm font-body text-muted mt-0.5">{r.studio.name}</span>
                  </span>
                  <span
                    className={`inline-flex items-center text-xs font-heading font-semibold px-2.5 py-1 rounded-pill ${
                      RECORDING_STATUS_CLASSES[r.status] ?? 'bg-field text-muted'
                    }`}
                  >
                    {RECORDING_STATUS_LABELS[r.status] ?? r.status}
                  </span>
                </div>
                {dulezite.length > 0 && (
                  <ul className="list-none p-0 m-0 flex flex-col gap-1">
                    {dulezite.map((s) => (
                      <li key={s.id} className="text-sm font-heading text-ink capitalize">
                        {popisSlotu(s.start, s.end, r.studio.timezone)}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
