import { randomBytes } from 'crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { notifyMany } from '@/lib/notifications';
import { DEFAULT_BUDGET_SETTINGS } from '@/lib/budget';
import {
  BLOCKING_SLOT_STATES,
  canTransition,
  checkOpeningHours,
  findCollisions,
  type Collision,
} from '@/lib/calendar';

/**
 * Databázová část kalendářů (zadani 8. 9. 2026). Čitelná a testovatelná
 * logika — kolize, pracovní doba, stavový automat — je v `calendar.ts`;
 * tenhle soubor jen načítá data a hlídá, aby se zápisy děly v transakci.
 */

// Prava jsou v lib/roles.ts (canManageCalendar, canViewCalendar) - at jsou
// vsechna na jednom miste a daji se pouzit i z klientskych komponent.

export function newAccessToken(): string {
  return randomBytes(24).toString('base64url');
}

// ---------------------------------------------------------------------------
// Nastavení
// ---------------------------------------------------------------------------

export type CalendarSettings = {
  pagesPerSession: number;
  sessionHours: number;
  holdHours: number;
};

/** Parametry z Ceníků. Když řádek ještě neexistuje, platí výchozí hodnoty. */
export async function loadCalendarSettings(): Promise<CalendarSettings> {
  const settings = await prisma.budgetSettings.findUnique({ where: { id: 'default' } });
  return {
    pagesPerSession: settings?.pagesPerSession ?? DEFAULT_BUDGET_SETTINGS.pagesPerSession,
    sessionHours: settings?.sessionHours ?? DEFAULT_BUDGET_SETTINGS.sessionHours,
    holdHours: settings?.holdHours ?? 72,
  };
}

export async function loadStudios() {
  return prisma.studio.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    include: {
      hours: true,
      presets: { orderBy: { sortOrder: 'asc' } },
    },
  });
}

// ---------------------------------------------------------------------------
// Uvolňování prošlých držení
// ---------------------------------------------------------------------------

/**
 * Vrátí termíny, které herec vybral, ale produkce je včas nepotvrdila, zpátky
 * do nabídky. Vercel nemá nic, co by běželo samo, takže se to dělá LÍNĚ —
 * při každém čtení kalendáře. Je to idempotentní a levné (jeden dotaz na
 * index), takže to nevadí ani při každém zobrazení.
 *
 * Nabídka se vrací do stavu SENT, ne do koše: okna zůstávají nabídnutá,
 * herec může vybrat znovu.
 */
export async function releaseExpiredHolds(): Promise<string[]> {
  const ted = new Date();
  const prosle = await prisma.recordingRequest.findMany({
    where: { status: 'SUBMITTED', holdUntil: { lt: ted } },
    select: { id: true, actorName: true, actorUserId: true, createdById: true, projectName: true },
  });
  if (prosle.length === 0) return [];

  for (const request of prosle) {
    await prisma.$transaction(async (tx) => {
      await tx.recordingSlot.updateMany({
        where: { requestId: request.id, state: 'SELECTED' },
        data: { state: 'OFFERED', selectedAt: null },
      });
      await tx.recordingRequest.update({
        where: { id: request.id },
        data: { status: 'SENT', holdUntil: null, submittedAt: null },
      });
      await tx.recordingEvent.create({
        data: {
          requestId: request.id,
          actorLabel: 'systém',
          type: 'HOLD_EXPIRED',
          fromStatus: 'SUBMITTED',
          toStatus: 'SENT',
          note: 'Vypršelo držení termínů, vrátily se do nabídky.',
        },
      });
    });
  }

  // Notifikace az po transakcich - kdyby zapis notifikace selhal, uvolneni
  // uz je hotove a to je to podstatne.
  for (const request of prosle) {
    await notifyMany([request.createdById, request.actorUserId], {
      kind: 'RECORDING_HOLD_EXPIRED',
      title: 'Vypršelo držení termínů',
      body: `${request.projectName} · ${request.actorName} — termíny se vrátily do nabídky`,
      url: `/kalendar/nabidka/${request.id}`,
    });
  }

  return prosle.map((r) => r.id);
}

// ---------------------------------------------------------------------------
// Obsazenost
// ---------------------------------------------------------------------------

export type Occupancy = {
  slots: {
    id: string;
    studioId: string;
    start: Date;
    end: Date;
    state: string;
    label: string;
    requestId: string;
  }[];
  blocks: { id: string; studioId: string; start: Date; end: Date; title: string; kind: string }[];
};

/**
 * Co ve studiích zabírá čas. Obsazeno = termín ve stavu SELECTED nebo
 * CONFIRMED, plus blokace. Jedna tabulka slotů, žádná paralelní evidence
 * rezervací — proto se nikde nemůžou rozejít dvě kopie.
 */
export async function loadOccupancy(
  studioIds: string[],
  from: Date,
  to: Date,
  options: { includeOffered?: boolean } = {},
): Promise<Occupancy> {
  const states = options.includeOffered ? [...BLOCKING_SLOT_STATES, 'OFFERED'] : BLOCKING_SLOT_STATES;

  const [slots, blocks] = await Promise.all([
    prisma.recordingSlot.findMany({
      where: {
        studioId: { in: studioIds },
        state: { in: states as never },
        start: { lt: to },
        end: { gt: from },
      },
      include: { request: { select: { id: true, projectName: true, actorName: true } } },
      orderBy: { start: 'asc' },
    }),
    prisma.studioBlock.findMany({
      where: { studioId: { in: studioIds }, start: { lt: to }, end: { gt: from } },
      orderBy: { start: 'asc' },
    }),
  ]);

  return {
    slots: slots.map((s) => ({
      id: s.id,
      studioId: s.studioId,
      start: s.start,
      end: s.end,
      state: s.state,
      requestId: s.requestId,
      label: `${s.request.projectName} · ${s.request.actorName}`,
    })),
    blocks: blocks.map((b) => ({
      id: b.id,
      studioId: b.studioId,
      start: b.start,
      end: b.end,
      title: b.title,
      kind: b.kind,
    })),
  };
}

/** Termíny herce napříč všemi projekty — na kontrolu, že nemá dvě naráz. */
async function loadActorSlots(actorUserId: string | null, from: Date, to: Date, ignoreRequestId?: string) {
  if (!actorUserId) return [];
  const slots = await prisma.recordingSlot.findMany({
    where: {
      state: { in: BLOCKING_SLOT_STATES as never },
      start: { lt: to },
      end: { gt: from },
      request: {
        actorUserId,
        ...(ignoreRequestId ? { id: { not: ignoreRequestId } } : {}),
      },
    },
    include: { request: { select: { projectName: true } } },
  });
  return slots.map((s) => ({ id: s.id, start: s.start, end: s.end, label: s.request.projectName }));
}

// ---------------------------------------------------------------------------
// Kontrola termínu
// ---------------------------------------------------------------------------

export type SlotCheck = {
  ok: boolean;
  collisions: Collision[];
  /** Víkend nebo mimo běžnou dobu — projde, ale je to jen po domluvě. */
  warning?: string;
};

/**
 * Ověří jeden termín proti obsazenosti studia, blokacím, hercovým termínům
 * a pracovní době. Volá se dvakrát: při sestavování nabídky a ZNOVU při
 * odeslání výběru hercem — mezi tím se mohlo studio obsadit.
 */
export async function checkSlot(input: {
  studioId: string;
  start: Date;
  end: Date;
  actorUserId?: string | null;
  ignoreRequestId?: string;
  ignoreSlotId?: string;
}): Promise<SlotCheck> {
  const { studioId, start, end } = input;

  if (end.getTime() <= start.getTime()) {
    return { ok: false, collisions: [{ kind: 'STUDIO', message: 'Konec termínu musí být po začátku.' }] };
  }

  const [studio, obsazenost, hercovy] = await Promise.all([
    prisma.studio.findUnique({ where: { id: studioId }, include: { hours: true } }),
    loadOccupancy([studioId], start, end),
    loadActorSlots(input.actorUserId ?? null, start, end, input.ignoreRequestId),
  ]);

  if (!studio) {
    return { ok: false, collisions: [{ kind: 'STUDIO', message: 'Studio nenalezeno.' }] };
  }

  const kolize = findCollisions(
    { start, end },
    {
      studioSlots: obsazenost.slots.filter((s) => s.id !== input.ignoreSlotId && s.requestId !== input.ignoreRequestId),
      blocks: obsazenost.blocks,
      actorSlots: hercovy.filter((s) => s.id !== input.ignoreSlotId),
    },
  );

  const doba = checkOpeningHours({ start, end }, studio.timezone, studio.hours);

  // Mimo pracovni dobu je to upozorneni, ne zakaz - vikendy se domlouvaji se
  // zvukarem (zadani 8. 9. 2026).
  return {
    ok: kolize.length === 0,
    collisions: kolize,
    warning: doba.ok ? doba.message : doba.message,
  };
}

// ---------------------------------------------------------------------------
// Stavy a audit
// ---------------------------------------------------------------------------

export class StateError extends Error {}

/** Ohlídá, že přechod stavu dává smysl. Jinak se to dá rozbít z API. */
export function assertTransition(from: string, to: string): void {
  if (from === to) return;
  if (!canTransition(from, to)) {
    throw new StateError(`Z „${from}" se nedá přejít na „${to}".`);
  }
}

export type EventInput = {
  requestId: string;
  slotId?: string | null;
  userId?: string | null;
  actorLabel: string;
  type: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  note?: string | null;
  /**
   * Doplnkova data (puvodni a novy cas u presunu apod.). Typ musi byt
   * Prisma.InputJsonValue - obycejny Record<string, unknown> Prisma do Json
   * sloupce nepusti, protoze `unknown` neni platna JSON hodnota.
   */
  payload?: Prisma.InputJsonValue;
};

/**
 * Data pro zápis do historie. Uvnitř transakce se předává rovnou do
 * `tx.recordingEvent.create({ data: eventData(...) })`, mimo ni se použije
 * `recordEvent` níže.
 */
export function eventData(input: EventInput) {
  return {
    requestId: input.requestId,
    slotId: input.slotId ?? null,
    userId: input.userId ?? null,
    actorLabel: input.actorLabel,
    type: input.type,
    fromStatus: input.fromStatus ?? null,
    toStatus: input.toStatus ?? null,
    note: input.note ?? null,
    // Pole typu Json se v Prisme nesmi nastavit na null jako ostatni sloupce -
    // bud se posle hodnota, nebo se klic vynecha uplne. Proto tenhle spread.
    ...(input.payload !== undefined ? { payload: input.payload } : {}),
  };
}

/** Zápis do historie. Volá se u každé změny — bez výjimky. */
export async function recordEvent(input: EventInput) {
  return prisma.recordingEvent.create({ data: eventData(input) });
}
