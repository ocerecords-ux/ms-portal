import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { smiStudio, spravovanaStudia } from '@/lib/spravaKalendare';
import { checkSlot, loadOccupancy, recordEvent } from '@/lib/calendarServer';
import { popisUdalosti, zabiraStudio } from '@/lib/calendar';
import { notify } from '@/lib/notifications';
import { synchronizujUkolUdalosti, zrusUkolUdalosti } from '@/lib/kalendarUkolyServer';

/**
 * ÚPRAVA POTVRZENÉ FREKVENCE PŘÍMO V KALENDÁŘI (zadání 19. 9. 2026: „když
 * produkce dostane tyto termíny a dá je tlačítkem do kalendáře, tak aby pak
 * šly dvojklikem editovat a šlo by přidat zvukaře a změnit studio i čas.
 * Prostě všechno. Případně to i předělat na střih, když se frekvence zruší").
 *
 * Do 19. 9. se termín z nabídky v kalendáři upravit nedal - posouval se jen
 * v nabídce. Teď se chová jako každá jiná událost:
 *  - NATACENI: frekvence zůstává frekvencí nabídky (počítá se herci, drží
 *    vazbu na projekt), mění se studio, čas, zvukař a poznámka,
 *  - jiný druh (STRIH, údržba…): frekvence se zruší (CANCELLED) a na jejím
 *    místě vznikne obyčejná událost kalendáře toho druhu,
 *  - DELETE: frekvence se zruší úplně.
 *
 * Herec dostane oznámení, kdykoli se mu změní čas, studio, nebo frekvence
 * zmizí - je to jeho termín.
 */
const schema = z.object({
  studioId: z.string().trim().min(1),
  start: z.string().trim().min(8),
  end: z.string().trim().min(8),
  kind: z.enum(['NATACENI', 'STRIH', 'CASTING', 'HOLIDAY', 'VACATION', 'MAINTENANCE', 'INTERNAL', 'OTHER']),
  note: z.string().trim().max(1000).optional(),
  title: z.string().trim().max(160).optional(),
  caflouProjectId: z.string().trim().max(100).optional(),
  projectName: z.string().trim().max(300).optional(),
  zvukarUserId: z.string().trim().max(100).optional(),
  zvukarName: z.string().trim().max(200).optional(),
  /** Režie online (23. 9. 2026) - ruční výjimka proti automatu. */
  rezieOnline: z.boolean().optional(),
  /** Uložit i tak, i když se to s něčím kryje (23. 9. 2026) - viz blokace. */
  presto: z.boolean().optional(),
});

async function nactiFrekvenci(id: string | null) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { chyba: NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 }) } as const;
  }
  // Produkce všude, vedoucí pobočky ve svých studiích (22. 9. 2026).
  const sprava = await spravovanaStudia(session.user.id, session.user.role);
  if (!id) return { chyba: NextResponse.json({ error: 'Chybí termín.' }, { status: 400 }) } as const;
  const slot = await prisma.recordingSlot.findUnique({
    where: { id },
    include: {
      request: {
        select: { id: true, projectName: true, actorName: true, actorUserId: true, caflouProjectId: true },
      },
    },
  });
  if (!slot) return { chyba: NextResponse.json({ error: 'Termín nenalezen.' }, { status: 404 }) } as const;
  if (!smiStudio(sprava, slot.studioId)) {
    return { chyba: NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 }) } as const;
  }
  if (slot.state !== 'CONFIRMED' && slot.state !== 'SELECTED') {
    return {
      chyba: NextResponse.json({ error: 'Upravit jde jen vybraný nebo potvrzený termín.' }, { status: 409 }),
    } as const;
  }
  return { session, slot, sprava } as const;
}

function kdy(d: Date): string {
  return d.toLocaleString('cs-CZ', { timeZone: 'Europe/Prague', day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export async function PATCH(req: NextRequest) {
  try {
    const k = await nactiFrekvenci(req.nextUrl.searchParams.get('id'));
    if ('chyba' in k) return k.chyba;
    const { session, slot } = k;

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Neplatná data.' }, { status: 400 });
    }
    const d = parsed.data;
    if (!smiStudio(k.sprava, d.studioId)) {
      return NextResponse.json({ error: 'Do kalendáře tohoto studia zapisovat nemůžete.' }, { status: 403 });
    }
    const start = new Date(d.start);
    const end = new Date(d.end);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      return NextResponse.json({ error: 'Konec musí být po začátku.' }, { status: 400 });
    }
    const kdo = session.user.name || session.user.email;

    // --- Zustava nataceni: posun, jine studio, zvukar, poznamka ---------------
    if (d.kind === 'NATACENI') {
      const kontrola = await checkSlot({
        studioId: d.studioId,
        start,
        end,
        actorUserId: slot.request.actorUserId,
        ignoreSlotId: slot.id,
      });
      if (!kontrola.ok && !d.presto) {
        return NextResponse.json(
          { error: kontrola.collisions.map((c) => c.message).join(' '), kolize: true },
          { status: 409 },
        );
      }

      const posun =
        slot.studioId !== d.studioId || slot.start.getTime() !== start.getTime() || slot.end.getTime() !== end.getTime();

      await prisma.recordingSlot.update({
        where: { id: slot.id },
        data: {
          studioId: d.studioId,
          start,
          end,
          note: d.note || null,
          zvukarUserId: d.zvukarUserId || null,
          zvukarName: d.zvukarName || null,
          ...(d.rezieOnline === undefined ? {} : { rezieOnline: d.rezieOnline }),
        },
      });

      /**
       * Úkol z poznámky (23. 9. 2026) - patří zvukaři u téhle frekvence.
       * Když se zvukař vymění, úkol se přestěhuje; když u ní zatím žádný
       * není, počká se. Viz lib/kalendarUkolyServer.ts.
       */
      const studio = await prisma.studio
        .findUnique({ where: { id: d.studioId }, select: { timezone: true } })
        .catch(() => null);
      await synchronizujUkolUdalosti({
        typ: 'SLOT',
        id: slot.id,
        poznamka: d.note || null,
        zvukarUserId: d.zvukarUserId || null,
        zvukarName: d.zvukarName || null,
        nazevUdalosti: `${slot.request.projectName} · ${slot.request.actorName}`,
        zacatek: start,
        pasmo: studio?.timezone ?? 'Europe/Prague',
        kdo: { id: session.user.id, jmeno: kdo },
      });
      await recordEvent({
        requestId: slot.request.id,
        slotId: slot.id,
        userId: session.user.id,
        actorLabel: kdo,
        type: posun ? 'SLOT_MOVED' : 'SLOT_EDITED',
        note: posun ? `Přesunuto z ${kdy(slot.start)} na ${kdy(start)}.` : 'Upraveny údaje frekvence.',
        payload: {
          puvodne: { studioId: slot.studioId, start: slot.start.toISOString(), end: slot.end.toISOString() },
          nove: { studioId: d.studioId, start: start.toISOString(), end: end.toISOString() },
        },
      });
      if (posun && slot.request.actorUserId) {
        await notify({
          userId: slot.request.actorUserId,
          kind: 'RECORDING_CHANGED',
          title: 'Změna natáčecího termínu',
          body: `${slot.request.projectName} · ${kdy(slot.start)} → ${kdy(start)}`,
          url: '/moje-terminy',
        });
      }
      return NextResponse.json({ ok: true });
    }

    // --- Jiny druh: frekvence se rusi a vznika udalost kalendare -----------
    // Strih se vejde vedle jine prace, ostatni druhy kabinu drzi (20. 9. 2026).
    if (zabiraStudio(d.kind) && !d.presto) {
      const obsazeno = await loadOccupancy([d.studioId], start, end);
      const prekazka =
        obsazeno.slots.some((s) => s.id !== slot.id) || obsazeno.blocks.some((b) => zabiraStudio(b.kind));
      if (prekazka) {
        return NextResponse.json({ error: 'V tomhle čase už ve studiu něco je.', kolize: true }, { status: 409 });
      }
    }
    // Strih a casting (20. 9. 2026) se zapisuji jako prace ve studiu; casting si
    // herce z frekvence necha.
    const jeStrih = d.kind === 'STRIH' || d.kind === 'CASTING';
    const jeCasting = d.kind === 'CASTING';
    const pole = {
      caflouProjectId: d.caflouProjectId || slot.request.caflouProjectId,
      projectName: d.projectName || slot.request.projectName,
      actorUserId: jeCasting ? slot.request.actorUserId : null,
      actorName: jeCasting ? slot.request.actorName : null,
      zvukarUserId: d.zvukarUserId || null,
      zvukarName: d.zvukarName || null,
    };
    if (jeStrih && !pole.zvukarName) {
      return NextResponse.json({ error: 'Vyberte zvukaře.' }, { status: 400 });
    }
    if (!jeStrih && !d.title?.trim()) {
      return NextResponse.json({ error: 'Vyplňte, čeho se událost týká.' }, { status: 400 });
    }

    // Frekvence se ruší - úkol, který na ní visel, jde s ní (23. 9. 2026).
    // Na nové události se založí znovu z její poznámky, viz níž.
    await zrusUkolUdalosti('SLOT', slot.id);
    const [, novaUdalost] = await prisma.$transaction([
      prisma.recordingSlot.update({ where: { id: slot.id }, data: { state: 'CANCELLED' } }),
      prisma.studioBlock.create({
        data: {
          studioId: d.studioId,
          start,
          end,
          kind: d.kind,
          title: jeStrih ? popisUdalosti({ ...pole, kind: d.kind }) : d.title!.trim(),
          note: d.note || null,
          ...(jeStrih ? pole : {}),
          createdById: session.user.id,
        },
      }),
    ]);
    {
      const studio = await prisma.studio
        .findUnique({ where: { id: d.studioId }, select: { timezone: true } })
        .catch(() => null);
      await synchronizujUkolUdalosti({
        typ: 'BLOCK',
        id: novaUdalost.id,
        poznamka: novaUdalost.note,
        zvukarUserId: novaUdalost.zvukarUserId,
        zvukarName: novaUdalost.zvukarName,
        nazevUdalosti: novaUdalost.title || null,
        zacatek: novaUdalost.start,
        pasmo: studio?.timezone ?? 'Europe/Prague',
        kdo: { id: session.user.id, jmeno: kdo },
      });
    }
    await recordEvent({
      requestId: slot.request.id,
      slotId: slot.id,
      userId: session.user.id,
      actorLabel: kdo,
      type: 'SLOT_CANCELLED',
      note: `Frekvence ${kdy(slot.start)} zrušena a v kalendáři změněna na ${d.kind === 'STRIH' ? 'střih' : jeCasting ? 'casting' : d.kind}.`,
    });
    if (slot.request.actorUserId) {
      await notify({
        userId: slot.request.actorUserId,
        kind: 'RECORDING_CHANGED',
        title: 'Natáčecí termín zrušen',
        body: `${slot.request.projectName} · ${kdy(slot.start)}`,
        url: '/moje-terminy',
      });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('PATCH /api/kalendar/terminy selhalo:', err);
    const message = err instanceof Error ? err.message : 'Neznámá chyba.';
    return NextResponse.json({ error: `Uložení se nezdařilo (${message}).` }, { status: 500 });
  }
}

/** Zrušení frekvence z kalendáře. Termín zmizí, historie nabídky zůstává. */
export async function DELETE(req: NextRequest) {
  try {
    const k = await nactiFrekvenci(req.nextUrl.searchParams.get('id'));
    if ('chyba' in k) return k.chyba;
    const { session, slot } = k;

    // Úkol, který na frekvenci visel, jde pryč s ní (23. 9. 2026).
    await zrusUkolUdalosti('SLOT', slot.id);
    await prisma.recordingSlot.update({ where: { id: slot.id }, data: { state: 'CANCELLED' } });
    await recordEvent({
      requestId: slot.request.id,
      slotId: slot.id,
      userId: session.user.id,
      actorLabel: session.user.name || session.user.email,
      type: 'SLOT_CANCELLED',
      note: `Frekvence ${kdy(slot.start)} zrušena v kalendáři.`,
    });
    if (slot.request.actorUserId) {
      await notify({
        userId: slot.request.actorUserId,
        kind: 'RECORDING_CHANGED',
        title: 'Natáčecí termín zrušen',
        body: `${slot.request.projectName} · ${kdy(slot.start)}`,
        url: '/moje-terminy',
      });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/kalendar/terminy selhalo:', err);
    return NextResponse.json({ error: 'Zrušení se nezdařilo.' }, { status: 500 });
  }
}
