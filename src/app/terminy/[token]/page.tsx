import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { recordEvent } from '@/lib/calendarServer';
import { ActorPicker } from './ActorPicker';

/**
 * Výběr natáčecích termínů hercem (zadani 8. 9. 2026). Veřejná stránka —
 * herec sem přijde z e-mailu odkazem s tokenem, nepřihlašuje se a nikam
 * neopisuje žádný kód.
 *
 * Vidí jen svůj projekt: název, studio, nabídnutá okna, kolik jich má vybrat
 * a poznámku produkce. Žádné jiné projekty, žádné jiné herce, žádné interní
 * údaje.
 */
export const dynamic = 'force-dynamic';

export default async function ActorOfferPage({ params }: { params: { token: string } }) {
  const request = await prisma.recordingRequest.findUnique({
    where: { accessToken: params.token },
    include: {
      studio: { select: { name: true, location: true, timezone: true } },
      slots: { orderBy: { start: 'asc' } },
    },
  });
  if (!request) notFound();

  // Prvni otevreni odkazu posune stav na "herec vybira" - produkce tak vidi,
  // ze se k tomu herec dostal.
  if (request.status === 'SENT') {
    await prisma.recordingRequest.update({
      where: { id: request.id },
      data: { status: 'PICKING', openedAt: request.openedAt ?? new Date() },
    });
    await recordEvent({
      requestId: request.id,
      actorLabel: `${request.actorName} (odkaz)`,
      type: 'OPENED',
      fromStatus: 'SENT',
      toStatus: 'PICKING',
    });
  }

  const nabidnute = request.slots.filter((s) => s.state === 'OFFERED');
  const vybrane = request.slots.filter((s) => s.state === 'SELECTED' || s.state === 'CONFIRMED');

  return (
    <main className="min-h-screen bg-paper">
      <header className="bg-gradient-to-b from-brand-purple to-brand-purpleDeep px-6 sm:px-10 py-6 flex items-center gap-3 sm:gap-4">
        <span className="font-body text-brand-green font-semibold text-2xl sm:text-3xl">MS portal</span>
        <span className="w-px h-8 sm:h-10 bg-white/40" aria-hidden="true" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/mediaspace-logo.gif" alt="Mediaspace" className="h-12 sm:h-14 w-auto" />
      </header>

      <div className="max-w-2xl mx-auto px-6 sm:px-10 py-8 sm:py-12 flex flex-col gap-6">
        <div>
          <p className="text-xs font-heading text-muted uppercase tracking-wide m-0">Natáčecí termíny</p>
          <h1 className="font-display text-3xl sm:text-4xl text-ink m-0 mt-1">{request.projectName}</h1>
          <p className="text-muted text-sm mt-2 font-body m-0">
            {request.studio.name}
            {request.studio.location ? ` · ${request.studio.location}` : ''}
          </p>
        </div>

        {request.note && (
          <p className="text-sm font-body text-ink bg-surface border border-line rounded-card px-4 py-3 m-0">
            <strong>Poznámka produkce:</strong> {request.note}
          </p>
        )}

        <ActorPicker
          token={params.token}
          status={request.status}
          actorName={request.actorName}
          requiredSessions={request.requiredSessions}
          timezone={request.studio.timezone}
          note={request.actorNote}
          decisionNote={request.decisionNote}
          holdUntil={request.holdUntil ? request.holdUntil.toISOString() : null}
          offered={nabidnute.map((s) => ({
            id: s.id,
            start: s.start.toISOString(),
            end: s.end.toISOString(),
          }))}
          chosen={vybrane.map((s) => ({
            id: s.id,
            start: s.start.toISOString(),
            end: s.end.toISOString(),
            state: s.state,
          }))}
        />
      </div>
    </main>
  );
}
