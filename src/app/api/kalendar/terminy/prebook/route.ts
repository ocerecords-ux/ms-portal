import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canManageCalendar } from '@/lib/roles';
import { checkSlot, recordEvent } from '@/lib/calendarServer';
import { notify } from '@/lib/notifications';

/**
 * Produkce rozhoduje o žádosti herce o přesun za termín odevzdání
 * (zadání 19. 9. 2026: „musí mu tam vyskočit hláška, že to musíme potvrdit").
 */
const schema = z.object({ slotId: z.string().trim().min(1), action: z.enum(['approve', 'reject']) });

const kdy = (d: Date) =>
  d.toLocaleString('cs-CZ', { timeZone: 'Europe/Prague', day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' });

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !canManageCalendar(session.user.role)) {
      return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
    }
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'Neplatná data.' }, { status: 400 });

    const slot = await prisma.recordingSlot.findUnique({
      where: { id: parsed.data.slotId },
      include: { request: { select: { id: true, projectName: true, actorUserId: true } } },
    });
    if (!slot || !slot.prebookStart || !slot.prebookEnd || !slot.prebookStudioId) {
      return NextResponse.json({ error: 'Žádost o přesun už neexistuje.' }, { status: 404 });
    }
    const kdo = session.user.name || session.user.email;
    const zrusZadost = { prebookStart: null, prebookEnd: null, prebookStudioId: null, prebookAt: null };

    if (parsed.data.action === 'reject') {
      await prisma.recordingSlot.update({ where: { id: slot.id }, data: zrusZadost });
      await recordEvent({
        requestId: slot.request.id,
        slotId: slot.id,
        userId: session.user.id,
        actorLabel: kdo,
        type: 'PREBOOK_REJECTED',
        note: `Přesun na ${kdy(slot.prebookStart)} zamítnut, termín zůstává ${kdy(slot.start)}.`,
      });
      if (slot.request.actorUserId) {
        await notify({
          userId: slot.request.actorUserId,
          kind: 'RECORDING_CHANGED',
          title: 'Přesun termínu nepotvrzen',
          body: `${slot.request.projectName} · termín zůstává ${kdy(slot.start)}`,
          url: '/moje-terminy',
        });
      }
      return NextResponse.json({ ok: true });
    }

    const kontrola = await checkSlot({
      studioId: slot.prebookStudioId,
      start: slot.prebookStart,
      end: slot.prebookEnd,
      actorUserId: slot.request.actorUserId,
      ignoreSlotId: slot.id,
    });
    if (!kontrola.ok) {
      return NextResponse.json(
        { error: 'Nový čas je mezitím obsazený - přesun nejde potvrdit. Zamítněte ho a domluvte se s hercem.' },
        { status: 409 },
      );
    }
    const puvodne = slot.start;
    await prisma.recordingSlot.update({
      where: { id: slot.id },
      data: { studioId: slot.prebookStudioId, start: slot.prebookStart, end: slot.prebookEnd, ...zrusZadost },
    });
    await recordEvent({
      requestId: slot.request.id,
      slotId: slot.id,
      userId: session.user.id,
      actorLabel: kdo,
      type: 'SLOT_MOVED',
      note: `Přesun za termín odevzdání potvrzen: ${kdy(puvodne)} → ${kdy(slot.prebookStart)}.`,
    });
    if (slot.request.actorUserId) {
      await notify({
        userId: slot.request.actorUserId,
        kind: 'RECORDING_CHANGED',
        title: 'Přesun termínu potvrzen',
        body: `${slot.request.projectName} · nově ${kdy(slot.prebookStart)}`,
        url: '/moje-terminy',
      });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('POST /api/kalendar/terminy/prebook selhalo:', err);
    return NextResponse.json({ error: 'Rozhodnutí se nepodařilo uložit.' }, { status: 500 });
  }
}
