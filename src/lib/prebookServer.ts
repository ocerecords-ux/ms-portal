import { prisma } from '@/lib/db';
import { posledniDenFrekvence } from '@/lib/volnaMista';
import { volnaMistaProParametry } from '@/lib/volnaMistaServer';

/**
 * PŘEBOOKOVÁNÍ TERMÍNU HERCEM (zadání 19. 9. 2026: „aby viděl své termíny
 * v portálu, když se přihlásí. Zároveň aby měl možnost si i nějaký termín
 * přebookovat sám. Musí to zohlednit datum odevzdání. Jakmile to bude mimo
 * datum, tak to půjde, ale musí mu tam vyskočit hláška, že to musíme
 * potvrdit, protože se nám tímto posunuje termín odevzdání").
 *
 * - Nový čas do „poslední možné frekvence" (dva dny před datem dokončení
 *   projektu) se přesune hned a produkce dostane oznámení.
 * - Nový čas PO ní se jen zapíše jako žádost; termín zůstává, kde byl, dokud
 *   ji produkce v nabídce nepotvrdí.
 */

/** Jak daleko dopředu si herec může vybírat - měsíc za termín odevzdání. */
const DNU_PO_LIMITU = 30;

/** Poslední den bez potvrzení: 2 dny před dokončením, jinak konec období nabídky. */
export async function limitPrebooku(request: { caflouProjectId: string; periodTo: Date }): Promise<string> {
  const meta = await prisma.projectMeta.findUnique({
    where: { caflouProjectId: request.caflouProjectId },
    select: { endDate: true },
  });
  if (meta?.endDate) {
    const den = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Prague' }).format(meta.endDate);
    return posledniDenFrekvence(den);
  }
  return request.periodTo.toISOString().slice(0, 10);
}

/** Frekvence herce, kterou smí přebookovat - jen jeho a jen potvrzená, budoucí. */
export async function frekvenceHerce(slotId: string, userId: string) {
  const slot = await prisma.recordingSlot.findUnique({
    where: { id: slotId },
    include: {
      request: {
        select: {
          id: true,
          actorUserId: true,
          actorName: true,
          createdById: true,
          projectName: true,
          caflouProjectId: true,
          studioId: true,
          nabizenaStudia: true,
          periodTo: true,
          sessionMinutes: true,
          slots: { select: { id: true, studioId: true, start: true, end: true, state: true } },
        },
      },
    },
  });
  if (!slot || slot.request.actorUserId !== userId) return null;
  if (slot.state !== 'CONFIRMED' || slot.start.getTime() < Date.now()) return null;
  return slot;
}

/** Volná místa, kam se frekvence dá přesunout. Označí ta po termínu odevzdání. */
export async function mistaProPrebook(slot: NonNullable<Awaited<ReturnType<typeof frekvenceHerce>>>) {
  const limit = await limitPrebooku(slot.request);
  const zitra = new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 10);
  const konec = new Date(`${limit}T12:00:00.000Z`);
  konec.setUTCDate(konec.getUTCDate() + DNU_PO_LIMITU);

  // Ostatni terminy teze nabidky zabiraji misto herci; ten presouvany ne.
  const ostatni = slot.request.slots.filter(
    (s) => s.id !== slot.id && (s.state === 'SELECTED' || s.state === 'CONFIRMED'),
  );
  const { volna, studia } = await volnaMistaProParametry({
    studioId: slot.request.studioId,
    studioIds: slot.request.nabizenaStudia,
    actorUserId: slot.request.actorUserId,
    od: zitra,
    doo: konec.toISOString().slice(0, 10),
    sessionMinutes: slot.request.sessionMinutes,
    requestId: slot.request.id,
    vlastniDrzene: ostatni,
  });
  const tz = new Map(studia.map((s) => [s.id, s.timezone]));
  return {
    limit,
    mista: volna.map((m) => {
      const den = new Intl.DateTimeFormat('en-CA', { timeZone: tz.get(m.studioId) ?? 'Europe/Prague' }).format(m.start);
      return {
        studioId: m.studioId,
        start: m.start.toISOString(),
        end: m.end.toISOString(),
        poTerminu: den > limit,
      };
    }),
  };
}

/** Je den začátku po limitu? (v pražském čase) */
export function jePoLimitu(start: Date, limit: string): boolean {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Prague' }).format(start) > limit;
}
