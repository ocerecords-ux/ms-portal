import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canManageCalendar } from '@/lib/roles';
import { loadOccupancy, loadStudios, releaseExpiredHolds } from '@/lib/calendarServer';
import { OfferBuilder } from './OfferBuilder';

// Sestaveni nabidky terminu (zadani 8. 9. 2026). Produkcni tu vybira volna
// okna z kalendare studia - muze jich nabidnout vic, nez kolik jich herec
// potrebuje.
export const dynamic = 'force-dynamic';

export default async function OfferPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !canManageCalendar(session.user.role)) redirect('/projekty');

  await releaseExpiredHolds();

  const request = await prisma.recordingRequest.findUnique({
    where: { id: params.id },
    include: {
      studio: { include: { presets: { orderBy: { sortOrder: 'asc' } } } },
      slots: { orderBy: { start: 'asc' } },
      events: { orderBy: { createdAt: 'desc' }, take: 30 },
    },
  });
  if (!request) notFound();

  const studios = await loadStudios();

  // Obsazenost studia v celem obdobi nabidky - at je videt, kam se da sahnout.
  const occupancy = await loadOccupancy([request.studioId], request.periodFrom, request.periodTo);

  const baseUrl = (process.env.NEXTAUTH_URL || 'https://www.msportal.cz').replace(/\/$/, '');

  return (
    <div className="flex flex-col gap-6">
      <Link href="/kalendar" className="text-muted text-sm font-heading no-underline">
        ← Zpět na kalendář
      </Link>

      <OfferBuilder
        request={{
          id: request.id,
          caflouProjectId: request.caflouProjectId,
          projectName: request.projectName,
          actorName: request.actorName,
          actorEmail: request.actorEmail,
          studioId: request.studioId,
          studioName: request.studio.name,
          timezone: request.studio.timezone,
          pageCount: request.pageCount,
          requiredSessions: request.requiredSessions,
          sessionMinutes: request.sessionMinutes,
          periodFrom: request.periodFrom.toISOString().slice(0, 10),
          periodTo: request.periodTo.toISOString().slice(0, 10),
          note: request.note ?? '',
          actorNote: request.actorNote,
          decisionNote: request.decisionNote,
          status: request.status,
          holdUntil: request.holdUntil ? request.holdUntil.toISOString() : null,
          sentAt: request.sentAt ? request.sentAt.toISOString() : null,
          submittedAt: request.submittedAt ? request.submittedAt.toISOString() : null,
          offerUrl: `${baseUrl}/terminy/${request.accessToken}`,
        }}
        slots={request.slots.map((s) => ({
          id: s.id,
          start: s.start.toISOString(),
          end: s.end.toISOString(),
          state: s.state,
        }))}
        occupancy={[
          ...occupancy.slots
            .filter((s) => s.requestId !== request.id)
            .map((s) => ({ id: s.id, start: s.start.toISOString(), end: s.end.toISOString(), title: s.label })),
          ...occupancy.blocks.map((b) => ({
            id: b.id,
            start: b.start.toISOString(),
            end: b.end.toISOString(),
            title: b.title,
          })),
        ]}
        presets={request.studio.presets.map((p) => ({
          label: p.label,
          startMinutes: p.startMinutes,
          endMinutes: p.endMinutes,
        }))}
        studios={studios.map((s) => ({ id: s.id, name: s.name }))}
        historie={request.events.map((e) => ({
          id: e.id,
          type: e.type,
          actorLabel: e.actorLabel,
          note: e.note,
          createdAt: e.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
