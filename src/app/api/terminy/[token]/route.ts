import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { checkSlot, loadCalendarSettings, recordEvent } from '@/lib/calendarServer';

/**
 * Výběr termínů hercem (zadani 8. 9. 2026). VEŘEJNÝ endpoint — nabídka se
 * hledá výhradně podle tokenu z odkazu, žádné ID z adresy se nikam
 * nepropisuje a nezadává se žádný ověřovací kód.
 *
 * Herec musí vybrat PŘESNĚ tolik termínů, kolik je frekvencí. Před uložením
 * se každý termín ZNOVU ověří — mezi odesláním nabídky a výběrem se studio
 * mohlo obsadit.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  action: z.literal('submit'),
  slotIds: z.array(z.string().trim().min(1)).min(1).max(60),
  note: z.string().trim().max(2000).optional(),
});

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Neplatná data.' }, { status: 400 });
    }
    const d = parsed.data;

    const request = await prisma.recordingRequest.findUnique({
      where: { accessToken: params.token },
      include: { slots: true, studio: { select: { timezone: true } } },
    });
    if (!request) return NextResponse.json({ error: 'Nabídka nenalezena.' }, { status: 404 });

    if (!['SENT', 'PICKING', 'RETURNED'].includes(request.status)) {
      return NextResponse.json(
        { error: 'Tahle nabídka už výběr nepřijímá — ozvěte se prosím produkci.' },
        { status: 409 },
      );
    }

    const unikatni = Array.from(new Set(d.slotIds));
    if (unikatni.length !== request.requiredSessions) {
      return NextResponse.json(
        { error: `Vyberte prosím přesně ${request.requiredSessions} termínů.` },
        { status: 400 },
      );
    }

    const vybrane = request.slots.filter((s) => unikatni.includes(s.id));
    if (vybrane.length !== unikatni.length) {
      return NextResponse.json({ error: 'Některý z vybraných termínů už v nabídce není.' }, { status: 409 });
    }
    if (vybrane.some((s) => s.state !== 'OFFERED')) {
      return NextResponse.json({ error: 'Některý z vybraných termínů už není volný.' }, { status: 409 });
    }

    // Druha kontrola kolizi - mezi odeslanim nabidky a vyberem se studio
    // mohlo obsadit jinym projektem.
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
            error: `Termín ${slot.start.toLocaleString('cs-CZ', { timeZone: request.studio.timezone })} už bohužel není volný. Vyberte prosím jiný.`,
            slotId: slot.id,
          },
          { status: 409 },
        );
      }
    }

    const settings = await loadCalendarSettings();
    const drzetDo = new Date(Date.now() + settings.holdHours * 60 * 60 * 1000);

    await prisma.$transaction(async (tx) => {
      await tx.recordingSlot.updateMany({
        where: { id: { in: unikatni } },
        data: { state: 'SELECTED', selectedAt: new Date() },
      });
      await tx.recordingRequest.update({
        where: { id: request.id },
        data: {
          status: 'SUBMITTED',
          submittedAt: new Date(),
          holdUntil: drzetDo,
          actorNote: d.note || null,
        },
      });
    });

    await recordEvent({
      requestId: request.id,
      // Herec chodi pres odkaz, takze u nej zadny prihlaseny ucet neni.
      actorLabel: `${request.actorName} (odkaz)`,
      type: 'SUBMITTED',
      fromStatus: request.status,
      toStatus: 'SUBMITTED',
      note: d.note ? `Poznámka herce: ${d.note}` : null,
      payload: {
        terminy: vybrane.map((s) => `${s.start.toISOString()} – ${s.end.toISOString()}`),
        drzenoDo: drzetDo.toISOString(),
      },
    });

    return NextResponse.json({ ok: true, holdUntil: drzetDo.toISOString() });
  } catch (err) {
    console.error('POST /api/terminy/[token] selhalo:', err);
    const message = err instanceof Error ? err.message : 'Neznámá chyba.';
    return NextResponse.json({ error: `Výběr se nepodařilo uložit (${message}).` }, { status: 500 });
  }
}
