import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canManageCalendar } from '@/lib/roles';
import { checkSlot, recordEvent } from '@/lib/calendarServer';
import { minutesInZone, minutesToTime } from '@/lib/calendar';
import { sendRecordingDecisionEmail } from '@/lib/email';
import { notify } from '@/lib/notifications';

/**
 * Rozhodnutí produkce o výběru herce (zadani 8. 9. 2026).
 *
 * Schválení a potvrzení je JEDEN krok — potvrzením se z vybraných termínů
 * stávají pevné rezervace. Před tím se ještě jednou ověří, že je studio
 * pořád volné; mezi výběrem a potvrzením mohly přibýt jiné rezervace.
 */
const schema = z.object({
  action: z.enum(['confirm', 'return', 'reject', 'complete']),
  note: z.string().trim().max(2000).optional(),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !canManageCalendar(session.user.role)) {
      return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
    }

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Neplatná data.' }, { status: 400 });
    }
    const { action, note } = parsed.data;

    const request = await prisma.recordingRequest.findUnique({
      where: { id: params.id },
      include: { slots: true, studio: { select: { name: true, timezone: true } } },
    });
    if (!request) return NextResponse.json({ error: 'Nabídka nenalezena.' }, { status: 404 });

    const kdo = session.user.name || session.user.email;
    const baseUrl = (process.env.NEXTAUTH_URL || 'https://www.msportal.cz').replace(/\/$/, '');
    const offerUrl = `${baseUrl}/terminy/${request.accessToken}`;
    const vybrane = request.slots.filter((s) => s.state === 'SELECTED');

    // --- Oznaceni za dokoncene -------------------------------------------
    if (action === 'complete') {
      if (request.status !== 'CONFIRMED') {
        return NextResponse.json({ error: 'Dokončit jde jen potvrzená nabídka.' }, { status: 409 });
      }
      await prisma.recordingRequest.update({
        where: { id: request.id },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });
      await recordEvent({
        requestId: request.id,
        userId: session.user.id,
        actorLabel: kdo,
        type: 'COMPLETED',
        fromStatus: 'CONFIRMED',
        toStatus: 'COMPLETED',
      });
      return NextResponse.json({ ok: true });
    }

    if (request.status !== 'SUBMITTED') {
      return NextResponse.json(
        { error: 'Rozhodovat jde jen o výběru, který herec odeslal ke schválení.' },
        { status: 409 },
      );
    }

    // --- Vraceni k prepracovani ------------------------------------------
    if (action === 'return') {
      await prisma.$transaction(async (tx) => {
        // Terminy se vraci zpatky do nabidky, at ma herec z ceho vybirat.
        await tx.recordingSlot.updateMany({
          where: { requestId: request.id, state: 'SELECTED' },
          data: { state: 'OFFERED', selectedAt: null },
        });
        await tx.recordingRequest.update({
          where: { id: request.id },
          data: {
            status: 'RETURNED',
            holdUntil: null,
            submittedAt: null,
            decidedAt: new Date(),
            decidedById: session.user.id,
            decisionNote: note || null,
          },
        });
      });

      await recordEvent({
        requestId: request.id,
        userId: session.user.id,
        actorLabel: kdo,
        type: 'RETURNED',
        fromStatus: 'SUBMITTED',
        toStatus: 'RETURNED',
        note: note || null,
      });

      await sendRecordingDecisionEmail({
        to: request.actorEmail,
        actorName: request.actorName,
        projectName: request.projectName,
        studioName: request.studio.name,
        decision: 'RETURNED',
        note: note || null,
        slots: [],
        offerUrl,
      });

      if (request.actorUserId) {
        await notify({
          userId: request.actorUserId,
          kind: 'RECORDING_RETURNED',
          title: 'Vyberte prosím termíny znovu',
          body: `${request.projectName}${note ? ` — ${note}` : ''}`,
          url: '/moje-terminy',
        });
      }

      return NextResponse.json({ ok: true });
    }

    // --- Zamitnuti --------------------------------------------------------
    if (action === 'reject') {
      await prisma.$transaction(async (tx) => {
        await tx.recordingSlot.updateMany({
          where: { requestId: request.id, state: { in: ['OFFERED', 'SELECTED'] } },
          data: { state: 'RELEASED', selectedAt: null },
        });
        await tx.recordingRequest.update({
          where: { id: request.id },
          data: {
            status: 'REJECTED',
            holdUntil: null,
            decidedAt: new Date(),
            decidedById: session.user.id,
            decisionNote: note || null,
          },
        });
      });

      await recordEvent({
        requestId: request.id,
        userId: session.user.id,
        actorLabel: kdo,
        type: 'REJECTED',
        fromStatus: 'SUBMITTED',
        toStatus: 'REJECTED',
        note: note || null,
      });

      await sendRecordingDecisionEmail({
        to: request.actorEmail,
        actorName: request.actorName,
        projectName: request.projectName,
        studioName: request.studio.name,
        decision: 'REJECTED',
        note: note || null,
        slots: [],
        offerUrl,
      });

      if (request.actorUserId) {
        await notify({
          userId: request.actorUserId,
          kind: 'RECORDING_REJECTED',
          title: 'Výběr termínů byl zamítnut',
          body: `${request.projectName}${note ? ` — ${note}` : ''}`,
          url: '/moje-terminy',
        });
      }

      return NextResponse.json({ ok: true });
    }

    // --- Potvrzeni --------------------------------------------------------
    if (vybrane.length !== request.requiredSessions) {
      return NextResponse.json(
        { error: `Herec vybral ${vybrane.length} termínů, potřeba je ${request.requiredSessions}.` },
        { status: 409 },
      );
    }

    // Posledni kontrola tesne pred tim, nez se z terminu stanou pevne
    // rezervace. Drzeni neni zamek - mezitim mohla vzniknout jina rezervace.
    for (const slot of vybrane) {
      const kontrola = await checkSlot({
        studioId: slot.studioId,
        start: slot.start,
        end: slot.end,
        actorUserId: request.actorUserId,
        ignoreRequestId: request.id,
        ignoreSlotId: slot.id,
      });
      if (!kontrola.ok) {
        return NextResponse.json(
          {
            error: `Termín ${slot.start.toLocaleString('cs-CZ', { timeZone: request.studio.timezone })} už mezitím obsadil někdo jiný: ${kontrola.collisions
              .map((c) => c.message)
              .join(' ')} Vraťte výběr herci.`,
          },
          { status: 409 },
        );
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.recordingSlot.updateMany({
        where: { requestId: request.id, state: 'SELECTED' },
        data: { state: 'CONFIRMED' },
      });
      // Nevybrana okna uz nikdo nepotrebuje - uvolni se pro jine projekty.
      await tx.recordingSlot.updateMany({
        where: { requestId: request.id, state: 'OFFERED' },
        data: { state: 'RELEASED' },
      });
      await tx.recordingRequest.update({
        where: { id: request.id },
        data: {
          status: 'CONFIRMED',
          holdUntil: null,
          decidedAt: new Date(),
          decidedById: session.user.id,
          decisionNote: note || null,
        },
      });
    });

    const popisTerminu = vybrane.map((s) => {
      const den = new Intl.DateTimeFormat('cs-CZ', {
        timeZone: request.studio.timezone,
        weekday: 'long',
        day: 'numeric',
        month: 'numeric',
      }).format(s.start);
      const od = minutesToTime(minutesInZone(s.start, request.studio.timezone));
      const doo = minutesToTime(minutesInZone(s.end, request.studio.timezone));
      return `${den} · ${od}–${doo}`;
    });

    await recordEvent({
      requestId: request.id,
      userId: session.user.id,
      actorLabel: kdo,
      type: 'CONFIRMED',
      fromStatus: 'SUBMITTED',
      toStatus: 'CONFIRMED',
      note: note || null,
      payload: { terminy: popisTerminu },
    });

    await sendRecordingDecisionEmail({
      to: request.actorEmail,
      actorName: request.actorName,
      projectName: request.projectName,
      studioName: request.studio.name,
      decision: 'CONFIRMED',
      note: note || null,
      slots: popisTerminu,
      offerUrl,
    });

    if (request.actorUserId) {
      await notify({
        userId: request.actorUserId,
        kind: 'RECORDING_CONFIRMED',
        title: 'Termíny jsou potvrzené',
        body: `${request.projectName} · ${popisTerminu.join(', ')}`,
        url: '/moje-terminy',
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('POST /api/kalendar/nabidky/[id]/rozhodnuti selhalo:', err);
    const message = err instanceof Error ? err.message : 'Neznámá chyba.';
    return NextResponse.json({ error: `Rozhodnutí se nepodařilo uložit (${message}).` }, { status: 500 });
  }
}
