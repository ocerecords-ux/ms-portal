import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canManageCalendar } from '@/lib/roles';
import { loadCalendarSettings, newAccessToken, recordEvent } from '@/lib/calendarServer';
import { sessionsForPages } from '@/lib/calendar';

// Zalozeni nabidky terminu z projektove karty (zadani 8. 9. 2026).
// Projekt zije v Caflou, takze se sem klicuje pres caflouProjectId - stejne
// jako vykazy, doklady a smlouvy.
const schema = z.object({
  caflouProjectId: z.string().trim().min(1),
  projectName: z.string().trim().min(1).max(300),
  companyId: z.string().trim().optional(),
  actorUserId: z.string().trim().min(1, 'Vyberte herce.'),
  studioId: z.string().trim().min(1, 'Vyberte studio.'),
  pageCount: z.number().int().min(0).optional(),
  requiredSessions: z.number().int().min(1).max(60).optional(),
  sessionMinutes: z.number().int().min(30).max(720).optional(),
  periodFrom: z.string().trim().min(8),
  periodTo: z.string().trim().min(8),
  note: z.string().trim().max(2000).optional(),
});

function toDate(value: string, endOfDay = false): Date | null {
  const d = new Date(`${value}T${endOfDay ? '23:59:59' : '00:00:00'}.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !canManageCalendar(session.user.role)) {
      return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
    }

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Neplatná data.' }, { status: 400 });
    }
    const d = parsed.data;

    const [herec, studio, settings] = await Promise.all([
      prisma.user.findUnique({ where: { id: d.actorUserId }, select: { id: true, name: true, email: true, role: true } }),
      prisma.studio.findUnique({ where: { id: d.studioId }, select: { id: true } }),
      loadCalendarSettings(),
    ]);

    if (!herec || herec.role !== 'HEREC') {
      return NextResponse.json({ error: 'Vybraný uživatel není herec.' }, { status: 400 });
    }
    if (!studio) return NextResponse.json({ error: 'Studio nenalezeno.' }, { status: 404 });

    const periodFrom = toDate(d.periodFrom);
    const periodTo = toDate(d.periodTo, true);
    if (!periodFrom || !periodTo || periodTo <= periodFrom) {
      return NextResponse.json({ error: 'Období natáčení je zadané špatně.' }, { status: 400 });
    }

    // Pocet frekvenci se predvyplni z normostran, ale ULOZI SE NATVRDO -
    // pozdejsi zmena normostran v Caflou nesmi zpetne prepsat, na co se herec
    // dival. Zmena se resi notifikaci, ne tichym prepsanim.
    const requiredSessions =
      d.requiredSessions ?? sessionsForPages(d.pageCount ?? 0, settings.pagesPerSession);
    if (requiredSessions < 1) {
      return NextResponse.json(
        { error: 'Nevím, kolik frekvencí je potřeba — doplňte normostrany nebo počet ručně.' },
        { status: 400 },
      );
    }

    const request = await prisma.recordingRequest.create({
      data: {
        caflouProjectId: d.caflouProjectId,
        projectName: d.projectName,
        companyId: d.companyId || null,
        actorUserId: herec.id,
        actorName: herec.name || herec.email,
        actorEmail: herec.email,
        studioId: d.studioId,
        pageCount: d.pageCount ?? null,
        requiredSessions,
        sessionMinutes: d.sessionMinutes ?? settings.sessionHours * 60,
        periodFrom,
        periodTo,
        note: d.note || null,
        status: 'PREPARING',
        accessToken: newAccessToken(),
        createdById: session.user.id,
      },
    });

    // Herec projektu se zapamatuje - v Caflou je to jen text, tady uz je to
    // vazba na konkretni ucet (zadani 8. 9. 2026).
    await prisma.projectMeta.upsert({
      where: { caflouProjectId: d.caflouProjectId },
      update: { actorUserId: herec.id },
      create: { caflouProjectId: d.caflouProjectId, actorUserId: herec.id },
    });

    await recordEvent({
      requestId: request.id,
      userId: session.user.id,
      actorLabel: session.user.name || session.user.email,
      type: 'CREATED',
      toStatus: 'PREPARING',
      note: `Nabídka pro ${request.actorName}, ${requiredSessions} frekvencí.`,
    });

    return NextResponse.json(request, { status: 201 });
  } catch (err) {
    console.error('POST /api/kalendar/nabidky selhalo:', err);
    const message = err instanceof Error ? err.message : 'Neznámá chyba.';
    return NextResponse.json({ error: `Založení se nezdařilo (${message}).` }, { status: 500 });
  }
}
