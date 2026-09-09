import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canManageCalendar } from '@/lib/roles';
import { recordEvent } from '@/lib/calendarServer';
import { sendRecordingOfferEmail } from '@/lib/email';

// Odeslani nabidky herci. Nabidka musi obsahovat aspon tolik terminu, kolik
// jich ma herec vybrat - jinak nema z ceho vybirat.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !canManageCalendar(session.user.role)) {
      return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
    }

    const request = await prisma.recordingRequest.findUnique({
      where: { id: params.id },
      include: { studio: { select: { name: true } }, slots: { select: { state: true } } },
    });
    if (!request) return NextResponse.json({ error: 'Nabídka nenalezena.' }, { status: 404 });
    if (['CONFIRMED', 'COMPLETED', 'CANCELLED'].includes(request.status)) {
      return NextResponse.json({ error: 'Tuhle nabídku už poslat nejde.' }, { status: 409 });
    }

    const nabidnuto = request.slots.filter((s) => s.state === 'OFFERED').length;
    if (nabidnuto < request.requiredSessions) {
      return NextResponse.json(
        {
          error: `Herec má vybrat ${request.requiredSessions} termínů, ale v nabídce jich je jen ${nabidnuto}. Přidejte další.`,
        },
        { status: 400 },
      );
    }

    const baseUrl = (process.env.NEXTAUTH_URL || 'https://www.msportal.cz').replace(/\/$/, '');
    const result = await sendRecordingOfferEmail({
      to: request.actorEmail,
      actorName: request.actorName,
      projectName: request.projectName,
      studioName: request.studio.name,
      requiredSessions: request.requiredSessions,
      offeredCount: nabidnuto,
      periodFrom: request.periodFrom,
      periodTo: request.periodTo,
      note: request.note,
      offerUrl: `${baseUrl}/terminy/${request.accessToken}`,
    });

    if (!result.sent) {
      return NextResponse.json({ error: 'E-mail se nepodařilo odeslat — není nastavené SMTP.' }, { status: 503 });
    }

    await prisma.recordingRequest.update({
      where: { id: request.id },
      data: { status: 'SENT', sentAt: new Date(), decisionNote: null },
    });

    await recordEvent({
      requestId: request.id,
      userId: session.user.id,
      actorLabel: session.user.name || session.user.email,
      type: 'SENT',
      fromStatus: request.status,
      toStatus: 'SENT',
      note: `Odesláno na ${request.actorEmail}, nabídnuto ${nabidnuto} termínů.`,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('POST /api/kalendar/nabidky/[id]/odeslat selhalo:', err);
    const message = err instanceof Error ? err.message : 'Neznámá chyba.';
    return NextResponse.json({ error: `Odeslání se nezdařilo (${message}).` }, { status: 500 });
  }
}
