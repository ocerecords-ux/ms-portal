import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { checkSlot, recordEvent } from '@/lib/calendarServer';
import { notify } from '@/lib/notifications';
import { frekvenceHerce, jePoLimitu, limitPrebooku, mistaProPrebook } from '@/lib/prebookServer';

/**
 * Přebookování termínu hercem v Moje termíny (zadání 19. 9. 2026) - viz
 * lib/prebookServer.ts. GET vrátí volná místa, POST termín přesune, nebo
 * (po termínu odevzdání) zapíše žádost, kterou potvrzuje produkce.
 */
export const dynamic = 'force-dynamic';

const kdy = (d: Date) =>
  d.toLocaleString('cs-CZ', {
    timeZone: 'Europe/Prague',
    weekday: 'short',
    day: 'numeric',
    month: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Nejste přihlášeni.' }, { status: 401 });
  const slot = await frekvenceHerce(req.nextUrl.searchParams.get('slotId') ?? '', session.user.id);
  if (!slot) return NextResponse.json({ error: 'Tenhle termín změnit nejde.' }, { status: 404 });
  return NextResponse.json(await mistaProPrebook(slot));
}

const schema = z.object({
  slotId: z.string().trim().min(1),
  studioId: z.string().trim().min(1),
  start: z.string().trim().min(8),
  end: z.string().trim().min(8),
  /** Herec viděl hlášku o posunu termínu odevzdání a chce i tak. */
  souhlasPosun: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'Nejste přihlášeni.' }, { status: 401 });
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'Neplatná data.' }, { status: 400 });
    const d = parsed.data;

    const slot = await frekvenceHerce(d.slotId, session.user.id);
    if (!slot) return NextResponse.json({ error: 'Tenhle termín změnit nejde.' }, { status: 404 });

    const start = new Date(d.start);
    const end = new Date(d.end);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      return NextResponse.json({ error: 'Neplatný čas.' }, { status: 400 });
    }
    if (start.getTime() < Date.now() + 12 * 3600 * 1000) {
      return NextResponse.json({ error: 'Přesunout jde nejdřív na zítřek.' }, { status: 400 });
    }

    // Volno se overuje proti vsemu krome presouvaneho terminu samotneho.
    const kontrola = await checkSlot({
      studioId: d.studioId,
      start,
      end,
      actorUserId: slot.request.actorUserId,
      ignoreSlotId: slot.id,
    });
    if (!kontrola.ok) {
      return NextResponse.json({ error: 'Tenhle čas už je obsazený. Vyberte prosím jiný.' }, { status: 409 });
    }

    const limit = await limitPrebooku(slot.request);
    const poTerminu = jePoLimitu(start, limit);
    const herec = slot.request.actorName;

    if (poTerminu) {
      if (!d.souhlasPosun) {
        return NextResponse.json({ error: 'Tenhle přesun musí potvrdit produkce.', potrebaSouhlas: true }, { status: 409 });
      }
      await prisma.recordingSlot.update({
        where: { id: slot.id },
        data: { prebookStart: start, prebookEnd: end, prebookStudioId: d.studioId, prebookAt: new Date() },
      });
      await recordEvent({
        requestId: slot.request.id,
        slotId: slot.id,
        userId: session.user.id,
        actorLabel: herec,
        type: 'PREBOOK_REQUESTED',
        note: `Herec žádá přesun z ${kdy(slot.start)} na ${kdy(start)} - za termín odevzdání, čeká na potvrzení.`,
      });
      await notify({
        userId: slot.request.createdById,
        kind: 'RECORDING_PREBOOK',
        title: `${herec} žádá přesun za termín odevzdání`,
        body: `${slot.request.projectName} · ${kdy(slot.start)} → ${kdy(start)}`,
        url: `/kalendar/nabidka/${slot.request.id}`,
      });
      return NextResponse.json({ ok: true, cekaNaPotvrzeni: true });
    }

    await prisma.recordingSlot.update({
      where: { id: slot.id },
      data: {
        studioId: d.studioId,
        start,
        end,
        prebookStart: null,
        prebookEnd: null,
        prebookStudioId: null,
        prebookAt: null,
      },
    });
    await recordEvent({
      requestId: slot.request.id,
      slotId: slot.id,
      userId: session.user.id,
      actorLabel: herec,
      type: 'SLOT_MOVED',
      note: `Herec si termín přebookoval z ${kdy(slot.start)} na ${kdy(start)}.`,
    });
    await notify({
      userId: slot.request.createdById,
      kind: 'RECORDING_CHANGED',
      title: `${herec} si přebookoval termín`,
      body: `${slot.request.projectName} · ${kdy(slot.start)} → ${kdy(start)}`,
      url: `/kalendar/nabidka/${slot.request.id}`,
    });
    return NextResponse.json({ ok: true, cekaNaPotvrzeni: false });
  } catch (err) {
    console.error('POST /api/moje-terminy/prebook selhalo:', err);
    const message = err instanceof Error ? err.message : 'Neznámá chyba.';
    return NextResponse.json({ error: `Přesun se nezdařil (${message}).` }, { status: 500 });
  }
}

/** Herec si žádost o přesun rozmyslel. */
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Nejste přihlášeni.' }, { status: 401 });
  const slot = await frekvenceHerce(req.nextUrl.searchParams.get('slotId') ?? '', session.user.id);
  if (!slot) return NextResponse.json({ error: 'Termín nenalezen.' }, { status: 404 });
  await prisma.recordingSlot.update({
    where: { id: slot.id },
    data: { prebookStart: null, prebookEnd: null, prebookStudioId: null, prebookAt: null },
  });
  return NextResponse.json({ ok: true });
}
