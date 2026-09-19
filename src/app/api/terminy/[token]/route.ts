import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { checkSlot, loadCalendarSettings, recordEvent } from '@/lib/calendarServer';
import { notify } from '@/lib/notifications';
import { POZNAMKA_NAVRH_HERCE } from '@/lib/volnaMista';
import { studiaNabidky } from '@/lib/volnaMistaServer';

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

/**
 * VLASTNÍ NÁVRH ČASU (zadání 19. 9. 2026: „primárně nastavované tyto časy
 * frekvencí, ale herec měl možnost navrhnout, že může třeba 14–18, nebo chce
 * natáčet jen tři hodiny").
 *
 * Herec zadá den, studio a čas. Místo se ověří úplně stejně jako to, které
 * nabídl portál - volné studio, žádné jiné natáčení herce, v období nabídky
 * a v otevírací době studia - a přidá se do nabídky jako OFFERED s poznámkou
 * „Návrh herce". Vybírá se pak jako každé jiné.
 */
const navrhSchema = z.object({
  action: z.literal('navrh'),
  studioId: z.string().trim().min(1),
  start: z.string().trim().min(8),
  end: z.string().trim().min(8),
});

/** Frekvence kratší než hodina nedává smysl, delší než 10 h taky ne. */
const NAVRH_MIN_MINUT = 60;
const NAVRH_MAX_MINUT = 10 * 60;

async function navrhni(token: string, d: { studioId: string; start: string; end: string }) {
  const request = await prisma.recordingRequest.findUnique({
    where: { accessToken: token },
    select: { id: true, status: true, studioId: true, actorUserId: true, actorName: true, periodFrom: true, periodTo: true },
  });
  if (!request) return NextResponse.json({ error: 'Nabídka nenalezena.' }, { status: 404 });
  if (!['SENT', 'PICKING', 'RETURNED'].includes(request.status)) {
    return NextResponse.json({ error: 'Tahle nabídka už výběr nepřijímá.' }, { status: 409 });
  }

  const studia = await studiaNabidky(request.studioId, request.actorUserId);
  if (!studia.some((s) => s.id === d.studioId)) {
    return NextResponse.json({ error: 'V tomhle studiu natáčení nabízet nemůžeme.' }, { status: 400 });
  }

  const start = new Date(d.start);
  const end = new Date(d.end);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    return NextResponse.json({ error: 'Konec musí být po začátku.' }, { status: 400 });
  }
  const minut = (end.getTime() - start.getTime()) / 60000;
  if (minut < NAVRH_MIN_MINUT || minut > NAVRH_MAX_MINUT) {
    return NextResponse.json({ error: 'Frekvence může mít od 1 do 10 hodin.' }, { status: 400 });
  }
  if (start.getTime() < Date.now() + 12 * 3600 * 1000) {
    return NextResponse.json({ error: 'Navrhněte prosím termín nejdřív na zítřek.' }, { status: 400 });
  }
  // Obdobi je ulozene jako cele dny v UTC - na den presne to staci.
  if (start < new Date(request.periodFrom.getTime() - 24 * 3600 * 1000) || end > new Date(request.periodTo.getTime() + 24 * 3600 * 1000)) {
    return NextResponse.json({ error: 'Termín je mimo období natáčení.' }, { status: 400 });
  }

  const kontrola = await checkSlot({
    studioId: d.studioId,
    start,
    end,
    actorUserId: request.actorUserId,
    ignoreRequestId: request.id,
  });
  if (!kontrola.ok) {
    return NextResponse.json({ error: 'V tomhle čase už je studio obsazené. Zkuste prosím jiný.' }, { status: 409 });
  }
  // Mimo oteviraci dobu uplne (ne vikend po domluve) - checkSlot to vraci
  // jen jako upozorneni, tady se to nepusti.
  if (kontrola.warning && !/Víkend/.test(kontrola.warning)) {
    return NextResponse.json({ error: kontrola.warning }, { status: 400 });
  }

  const uzJe = await prisma.recordingSlot.findFirst({
    where: { requestId: request.id, studioId: d.studioId, start, end, state: 'OFFERED' },
    select: { id: true },
  });
  const slot =
    uzJe ??
    (await prisma.recordingSlot.create({
      data: { requestId: request.id, studioId: d.studioId, start, end, state: 'OFFERED', note: POZNAMKA_NAVRH_HERCE },
      select: { id: true },
    }));

  await recordEvent({
    requestId: request.id,
    slotId: slot.id,
    actorLabel: `${request.actorName} (odkaz)`,
    type: 'SLOT_ADDED',
    note: 'Herec navrhl vlastní čas.',
    payload: { start: start.toISOString(), end: end.toISOString() },
  });

  return NextResponse.json({ id: slot.id }, { status: 201 });
}

const schema = z.object({
  action: z.literal('submit'),
  slotIds: z.array(z.string().trim().min(1)).min(1).max(60),
  note: z.string().trim().max(2000).optional(),
});

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  try {
    const telo = await req.json().catch(() => null);
    if (telo?.action === 'navrh') {
      const navrh = navrhSchema.safeParse(telo);
      if (!navrh.success) return NextResponse.json({ error: 'Neplatný návrh.' }, { status: 400 });
      return await navrhni(params.token, navrh.data);
    }

    const parsed = schema.safeParse(telo);
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

    // Herec nemuze byt ve stejny cas ve dvou studiich - nabidka ted obsahuje
    // mista ze vsech studii jeho lokace (zadani 19. 9. 2026).
    const podleCasu = [...vybrane].sort((a, b) => a.start.getTime() - b.start.getTime());
    for (let i = 1; i < podleCasu.length; i += 1) {
      if (podleCasu[i].start < podleCasu[i - 1].end) {
        return NextResponse.json(
          { error: 'Dva vybrané termíny jsou ve stejný čas. Nechte prosím jen jeden z nich.' },
          { status: 400 },
        );
      }
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

    // Produkci dame vedet, ze je co schvalovat.
    await notify({
      userId: request.createdById,
      kind: 'RECORDING_SUBMITTED',
      title: `${request.actorName} vybral termíny`,
      body: `${request.projectName} · ${vybrane.length} termínů čeká na potvrzení`,
      url: `/kalendar/nabidka/${request.id}`,
    });

    return NextResponse.json({ ok: true, holdUntil: drzetDo.toISOString() });
  } catch (err) {
    console.error('POST /api/terminy/[token] selhalo:', err);
    const message = err instanceof Error ? err.message : 'Neznámá chyba.';
    return NextResponse.json({ error: `Výběr se nepodařilo uložit (${message}).` }, { status: 500 });
  }
}
