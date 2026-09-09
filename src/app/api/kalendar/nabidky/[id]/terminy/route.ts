import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canManageCalendar } from '@/lib/roles';
import { checkSlot, recordEvent } from '@/lib/calendarServer';

// Pridani a odebrani nabidnuteho terminu. Produkcni tim sklada NABIDKU -
// terminu muze nabidnout vic, nez kolik jich herec potrebuje.
const schema = z.object({
  action: z.enum(['add', 'remove']),
  slotId: z.string().trim().optional(),
  start: z.string().trim().optional(),
  end: z.string().trim().optional(),
  /** Pridat termin i pres upozorneni (vikend, mimo pracovni dobu). */
  force: z.boolean().optional(),
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
    const d = parsed.data;

    const request = await prisma.recordingRequest.findUnique({ where: { id: params.id } });
    if (!request) return NextResponse.json({ error: 'Nabídka nenalezena.' }, { status: 404 });
    if (['CONFIRMED', 'COMPLETED', 'CANCELLED', 'REJECTED'].includes(request.status)) {
      return NextResponse.json({ error: 'S touhle nabídkou se už nedá hýbat.' }, { status: 409 });
    }

    if (d.action === 'remove') {
      if (!d.slotId) return NextResponse.json({ error: 'Chybí termín ke smazání.' }, { status: 400 });
      const slot = await prisma.recordingSlot.findUnique({ where: { id: d.slotId } });
      if (!slot || slot.requestId !== request.id) {
        return NextResponse.json({ error: 'Termín nenalezen.' }, { status: 404 });
      }
      if (slot.state !== 'OFFERED') {
        return NextResponse.json(
          { error: 'Odebrat jde jen nabídnutý termín — vybraný nebo potvrzený ne.' },
          { status: 409 },
        );
      }
      await prisma.recordingSlot.delete({ where: { id: slot.id } });
      await recordEvent({
        requestId: request.id,
        userId: session.user.id,
        actorLabel: session.user.name || session.user.email,
        type: 'SLOT_REMOVED',
        payload: { start: slot.start.toISOString(), end: slot.end.toISOString() },
      });
      return NextResponse.json({ ok: true });
    }

    if (!d.start || !d.end) {
      return NextResponse.json({ error: 'Chybí čas termínu.' }, { status: 400 });
    }
    const start = new Date(d.start);
    const end = new Date(d.end);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return NextResponse.json({ error: 'Neplatný čas termínu.' }, { status: 400 });
    }
    if (start < request.periodFrom || end > request.periodTo) {
      return NextResponse.json({ error: 'Termín je mimo období, které má nabídka nastavené.' }, { status: 400 });
    }

    // Kontrola kolizi: obsazene studio, blokace, a jestli herec nema v tom
    // case natáčení na jinem projektu.
    const kontrola = await checkSlot({
      studioId: request.studioId,
      start,
      end,
      actorUserId: request.actorUserId,
      ignoreRequestId: request.id,
    });
    if (!kontrola.ok) {
      return NextResponse.json(
        { error: kontrola.collisions.map((c) => c.message).join(' '), collisions: kontrola.collisions },
        { status: 409 },
      );
    }
    // Vikend a cas mimo pracovni dobu jde nabidnout, ale az po potvrzeni -
    // domlouva se to se zvukarem (zadani 8. 9. 2026).
    if (kontrola.warning && !d.force) {
      return NextResponse.json({ warning: kontrola.warning, needsConfirm: true }, { status: 200 });
    }

    // Dva stejne terminy v jedne nabidce nedavaji smysl.
    const uzJe = await prisma.recordingSlot.findFirst({
      where: { requestId: request.id, start, end, state: { in: ['OFFERED', 'SELECTED', 'CONFIRMED'] } },
      select: { id: true },
    });
    if (uzJe) return NextResponse.json({ error: 'Tenhle termín už v nabídce je.' }, { status: 409 });

    const slot = await prisma.recordingSlot.create({
      data: { requestId: request.id, studioId: request.studioId, start, end, state: 'OFFERED' },
    });

    await recordEvent({
      requestId: request.id,
      slotId: slot.id,
      userId: session.user.id,
      actorLabel: session.user.name || session.user.email,
      type: 'SLOT_ADDED',
      payload: { start: start.toISOString(), end: end.toISOString() },
    });

    return NextResponse.json(slot, { status: 201 });
  } catch (err) {
    console.error('POST /api/kalendar/nabidky/[id]/terminy selhalo:', err);
    const message = err instanceof Error ? err.message : 'Neznámá chyba.';
    return NextResponse.json({ error: `Uložení se nezdařilo (${message}).` }, { status: 500 });
  }
}
