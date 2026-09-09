import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canManageCalendar } from '@/lib/roles';
import { recordEvent } from '@/lib/calendarServer';

// Uprava parametru nabidky (studio, obdobi, delka frekvence, poznamka) a
// jeji zruseni. Zmena studia nebo delky se dotyka uz nabidnutych terminu,
// proto se pri zmene studia nabidka vycisti - jinak by okna visela u ciziho
// kalendare.
const schema = z.object({
  studioId: z.string().trim().min(1).optional(),
  requiredSessions: z.number().int().min(1).max(60).optional(),
  sessionMinutes: z.number().int().min(30).max(720).optional(),
  pageCount: z.number().int().min(0).nullable().optional(),
  periodFrom: z.string().trim().min(8).optional(),
  periodTo: z.string().trim().min(8).optional(),
  note: z.string().trim().max(2000).nullable().optional(),
  cancel: z.boolean().optional(),
});

function toDate(value: string, endOfDay = false): Date | null {
  const d = new Date(`${value}T${endOfDay ? '23:59:59' : '00:00:00'}.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
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

    if (request.status === 'CONFIRMED' || request.status === 'COMPLETED') {
      return NextResponse.json(
        { error: 'Potvrzenou nabídku už tudy neměňte — termíny se přesouvají v kalendáři.' },
        { status: 409 },
      );
    }

    if (d.cancel) {
      await prisma.$transaction(async (tx) => {
        await tx.recordingSlot.updateMany({
          where: { requestId: request.id, state: { in: ['OFFERED', 'SELECTED'] } },
          data: { state: 'RELEASED' },
        });
        await tx.recordingRequest.update({
          where: { id: request.id },
          data: { status: 'CANCELLED', holdUntil: null },
        });
      });
      await recordEvent({
        requestId: request.id,
        userId: session.user.id,
        actorLabel: session.user.name || session.user.email,
        type: 'CANCELLED',
        fromStatus: request.status,
        toStatus: 'CANCELLED',
      });
      return NextResponse.json({ ok: true });
    }

    const data: Record<string, unknown> = {};
    if (d.requiredSessions !== undefined) data.requiredSessions = d.requiredSessions;
    if (d.sessionMinutes !== undefined) data.sessionMinutes = d.sessionMinutes;
    if (d.pageCount !== undefined) data.pageCount = d.pageCount;
    if (d.note !== undefined) data.note = d.note || null;

    if (d.periodFrom !== undefined) {
      const date = toDate(d.periodFrom);
      if (!date) return NextResponse.json({ error: 'Neplatný začátek období.' }, { status: 400 });
      data.periodFrom = date;
    }
    if (d.periodTo !== undefined) {
      const date = toDate(d.periodTo, true);
      if (!date) return NextResponse.json({ error: 'Neplatný konec období.' }, { status: 400 });
      data.periodTo = date;
    }

    // Zmena studia: uz nabidnute terminy patri jinemu kalendari, takze se
    // uvolni. Radeji prazdna nabidka nez okna visici u ciziho studia.
    const zmenaStudia = d.studioId !== undefined && d.studioId !== request.studioId;
    if (d.studioId !== undefined) data.studioId = d.studioId;

    await prisma.$transaction(async (tx) => {
      if (zmenaStudia) {
        await tx.recordingSlot.deleteMany({ where: { requestId: request.id, state: 'OFFERED' } });
      }
      await tx.recordingRequest.update({ where: { id: request.id }, data });
    });

    if (zmenaStudia) {
      await recordEvent({
        requestId: request.id,
        userId: session.user.id,
        actorLabel: session.user.name || session.user.email,
        type: 'STUDIO_CHANGED',
        note: 'Změna studia — nabídnuté termíny se zrušily.',
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('PATCH /api/kalendar/nabidky/[id] selhalo:', err);
    const message = err instanceof Error ? err.message : 'Neznámá chyba.';
    return NextResponse.json({ error: `Uložení se nezdařilo (${message}).` }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !canManageCalendar(session.user.role)) {
      return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
    }

    const request = await prisma.recordingRequest.findUnique({
      where: { id: params.id },
      select: { status: true },
    });
    if (!request) return NextResponse.json({ error: 'Nabídka nenalezena.' }, { status: 404 });
    if (request.status !== 'DRAFT' && request.status !== 'PREPARING') {
      return NextResponse.json(
        { error: 'Smazat jde jen nabídku, která se ještě nedostala k herci — jinak ji zrušte.' },
        { status: 409 },
      );
    }

    await prisma.recordingRequest.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/kalendar/nabidky/[id] selhalo:', err);
    const message = err instanceof Error ? err.message : 'Neznámá chyba.';
    return NextResponse.json({ error: `Smazání se nezdařilo (${message}).` }, { status: 500 });
  }
}
