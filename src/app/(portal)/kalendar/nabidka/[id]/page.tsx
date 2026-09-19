import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canManageCalendar } from '@/lib/roles';
import { loadStudios, releaseExpiredHolds } from '@/lib/calendarServer';
import { obnovVolnaMista } from '@/lib/volnaMistaServer';
import { OfferBuilder } from './OfferBuilder';

// Nabidka terminu (zadani 8. 9. 2026). Od 19. 9. 2026 se termíny nenabízí
// ručně - nabídka obsahuje všechna volná místa ve studiích herce až do
// poslední možné frekvence (viz lib/volnaMista.ts). Produkce tu jen upraví
// parametry, odešle a pak potvrdí, co herec vybral.
export const dynamic = 'force-dynamic';

export default async function OfferPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !canManageCalendar(session.user.role)) redirect('/projekty');

  await releaseExpiredHolds();
  // Srovnat nabidku s aktualnim kalendarem, nez se ukaze.
  const obnova = await obnovVolnaMista(params.id);

  const request = await prisma.recordingRequest.findUnique({
    where: { id: params.id },
    include: {
      studio: { include: { presets: { orderBy: { sortOrder: 'asc' } } } },
      slots: { orderBy: { start: 'asc' }, include: { studio: { select: { name: true } } } },
      events: { orderBy: { createdAt: 'desc' }, take: 30 },
    },
  });
  if (!request) notFound();

  const studios = await loadStudios();

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
          // Zaskrtnuta studia - bez vlastniho vyberu ta, ze kterych se opravdu nabizi.
          studioIds:
            request.nabizenaStudia.length > 0
              ? request.nabizenaStudia
              : (obnova?.studia.map((s) => s.id) ?? [request.studioId]),
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
          studioName: s.studio.name,
          note: s.note,
        }))}
        studiaNabidky={obnova?.studia.map((s) => s.name) ?? [request.studio.name]}
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
