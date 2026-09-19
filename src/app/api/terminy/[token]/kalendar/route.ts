import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { buildIcs, type IcsEvent } from '@/lib/ics';

/**
 * POTVRZENÉ TERMÍNY HERCE DO KALENDÁŘE (zadání 19. 9. 2026: „když přijdou
 * herci potvrzené termíny od nás, aby tam bylo tlačítko přidat do kalendáře
 * a mu se to tam automaticky nasype").
 *
 * Stejný odkaz slouží dvakrát:
 *  - https://… otevřený v telefonu nebo počítači = jednorázové přidání
 *    (iPhone, Mac i Outlook nabídnou „Přidat vše"),
 *  - webcal://… = odběr. Kalendář si ho sám obnovuje, takže přesun nebo
 *    zrušení frekvence v portálu se hercovi projeví bez dalšího klikání.
 *
 * Přístup je přes token nabídky - stejný, jaký má herec v e-mailu. Když
 * herec má účet, jdou ven všechny jeho potvrzené frekvence napříč projekty
 * (jeden odběr stačí na všechno); bez účtu jen tahle nabídka.
 */
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const request = await prisma.recordingRequest.findUnique({
    where: { accessToken: params.token },
    select: { id: true, actorUserId: true, actorName: true },
  });
  if (!request) return new NextResponse('Odkaz už neplatí.', { status: 404 });

  const slots = await prisma.recordingSlot.findMany({
    where: request.actorUserId
      ? { state: 'CONFIRMED', request: { actorUserId: request.actorUserId } }
      : { state: 'CONFIRMED', requestId: request.id },
    orderBy: { start: 'asc' },
    include: {
      studio: { select: { name: true, location: true } },
      request: { select: { projectName: true } },
    },
  });

  const events: IcsEvent[] = slots.map((s) => ({
    // Stejne UID jako osobni odber v /api/ical - kdo ma oboje, nema to dvakrat.
    uid: `slot-${s.id}@msportal.cz`,
    start: s.start,
    end: s.end,
    summary: `Natáčení – ${s.request.projectName}`,
    description: [`Natáčení – ${s.request.projectName}`, s.note].filter(Boolean).join('\n'),
    location: [s.studio.name, s.studio.location].filter(Boolean).join(', '),
    updatedAt: s.updatedAt,
  }));

  return new NextResponse(buildIcs(`Natáčení Mediaspace – ${request.actorName}`, events), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="nataceni-mediaspace.ics"',
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}
