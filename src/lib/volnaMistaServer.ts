import { prisma } from '@/lib/db';
import { BLOCKING_SLOT_STATES } from '@/lib/calendar';
import { POZNAMKA_NAVRH_HERCE, POZNAMKA_VIKEND, klicMista, spocitejVolnaMista } from '@/lib/volnaMista';

/**
 * Nabídka termínů se skládá SAMA (zadání 19. 9. 2026: „nechci termíny
 * nabídnout ručně") - viz výpočet v lib/volnaMista.ts.
 *
 * `obnovVolnaMista` srovná nabídnutá místa nabídky s tím, co je v kalendáři
 * právě volné: chybějící přidá, obsazená mezitím odebere. Volá se při
 * založení, uložení parametrů, odeslání a pokaždé, když se nabídka otevře
 * (produkce i herec) - kalendář se mění průběžně a herec má vidět aktuální
 * stav, ne ten z doby odeslání e-mailu.
 *
 * Sahá jen na místa ve stavu OFFERED. Vybrané a potvrzené termíny zůstávají.
 */

/** Stavy, ve kterých se nabídka ještě skládá nebo z ní herec vybírá. */
export const STAVY_S_NABIDKOU = ['DRAFT', 'PREPARING', 'SENT', 'PICKING', 'RETURNED'];

/** Studia, ve kterých herec umí natáčet, plus studio nabídky. */
export async function studiaNabidky(studioId: string, actorUserId: string | null) {
  const herec = actorUserId
    ? await prisma.user.findUnique({ where: { id: actorUserId }, select: { studioLocations: true } })
    : null;
  const lokace = herec?.studioLocations ?? [];
  return prisma.studio.findMany({
    where: { active: true, OR: [{ id: studioId }, ...(lokace.length > 0 ? [{ name: { in: lokace } }] : [])] },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    include: { hours: true, presets: { orderBy: { sortOrder: 'asc' } } },
  });
}

/** Zítřek 0:00 v Praze - dnešek se už nenabízí, na to je pozdě. */
function zitra(): Date {
  const dnes = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Prague' }).format(new Date());
  const d = new Date(`${dnes}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  // Pulnoc v Praze je nejpozdeji ve 23:00 UTC predchoziho dne - o dve hodiny
  // driv to je bezpecne pro letni i zimni cas a rano se stejne netoci.
  return new Date(d.getTime() - 2 * 3600 * 1000);
}

export type VysledekObnovy = {
  /** Kolik míst je teď v nabídce. */
  nabidnuto: number;
  /** Studia, ze kterých se nabízí. */
  studia: { id: string; name: string }[];
};

export async function obnovVolnaMista(requestId: string): Promise<VysledekObnovy | null> {
  const request = await prisma.recordingRequest.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      status: true,
      studioId: true,
      actorUserId: true,
      periodFrom: true,
      periodTo: true,
      sessionMinutes: true,
      slots: { select: { id: true, studioId: true, start: true, end: true, state: true, note: true } },
    },
  });
  if (!request || !STAVY_S_NABIDKOU.includes(request.status)) return null;

  const studia = await studiaNabidky(request.studioId, request.actorUserId);
  const ids = studia.map((s) => s.id);
  const od = request.periodFrom.toISOString().slice(0, 10);
  const doo = request.periodTo.toISOString().slice(0, 10);
  // Okraje s rezervou den na kazde strane - pasma studii se lisi.
  const rozsahOd = new Date(request.periodFrom.getTime() - 24 * 3600 * 1000);
  const rozsahDo = new Date(request.periodTo.getTime() + 24 * 3600 * 1000);

  const [terminy, udalosti, hercovy] = await Promise.all([
    prisma.recordingSlot.findMany({
      where: {
        studioId: { in: ids },
        state: { in: BLOCKING_SLOT_STATES as never },
        requestId: { not: request.id },
        start: { lt: rozsahDo },
        end: { gt: rozsahOd },
      },
      select: { id: true, studioId: true, start: true, end: true },
    }),
    prisma.studioBlock.findMany({
      where: { studioId: { in: ids }, start: { lt: rozsahDo }, end: { gt: rozsahOd } },
      select: { id: true, studioId: true, start: true, end: true },
    }),
    request.actorUserId
      ? prisma.recordingSlot.findMany({
          where: {
            state: { in: BLOCKING_SLOT_STATES as never },
            requestId: { not: request.id },
            request: { actorUserId: request.actorUserId },
            start: { lt: rozsahDo },
            end: { gt: rozsahOd },
          },
          select: { id: true, start: true, end: true },
        })
      : Promise.resolve([]),
  ]);

  // Vlastni vybrane a potvrzene terminy teto nabidky taky zabiraji misto -
  // herec nemuze mit ve stejny cas dve frekvence.
  const vlastniDrzene = request.slots.filter((s) => s.state === 'SELECTED' || s.state === 'CONFIRMED');

  const volna = spocitejVolnaMista({
    studia: studia.map((s) => ({ id: s.id, timezone: s.timezone, hours: s.hours, presets: s.presets })),
    od,
    doo,
    delkaMinut: request.sessionMinutes,
    obsazeno: [...terminy, ...udalosti, ...vlastniDrzene],
    hercovy: [...hercovy, ...vlastniDrzene],
    nejdrive: zitra(),
  });

  const chtene = new Map(volna.map((m) => [klicMista(m), m]));
  // Vlastni navrhy herce se neprepocitavaji - nejsou ze zkratek studia a
  // obnova by je jinak smazala hned po zapsani.
  const nabidnute = request.slots.filter((s) => s.state === 'OFFERED' && s.note !== POZNAMKA_NAVRH_HERCE);
  const navrhu = request.slots.filter((s) => s.state === 'OFFERED' && s.note === POZNAMKA_NAVRH_HERCE).length;
  const uzJsou = new Set(nabidnute.map(klicMista));

  const odebrat = nabidnute.filter((s) => !chtene.has(klicMista(s))).map((s) => s.id);
  const pridat = volna.filter((m) => !uzJsou.has(klicMista(m)));

  if (odebrat.length > 0 || pridat.length > 0) {
    await prisma.$transaction([
      prisma.recordingSlot.deleteMany({ where: { id: { in: odebrat }, state: 'OFFERED' } }),
      prisma.recordingSlot.createMany({
        data: pridat.map((m) => ({
          requestId: request.id,
          studioId: m.studioId,
          start: m.start,
          end: m.end,
          state: 'OFFERED' as const,
          note: m.poDomluve ? POZNAMKA_VIKEND : null,
        })),
      }),
    ]);
  }

  return { nabidnuto: chtene.size + navrhu, studia: studia.map((s) => ({ id: s.id, name: s.name })) };
}
