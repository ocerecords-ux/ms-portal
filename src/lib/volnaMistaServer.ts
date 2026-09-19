import { prisma } from '@/lib/db';
import { BLOCKING_SLOT_STATES } from '@/lib/calendar';
import { POZNAMKA_NAVRH_HERCE, POZNAMKA_VIKEND, klicMista, mestoStudia, spocitejVolnaMista } from '@/lib/volnaMista';

export { mestoStudia };

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

/**
 * Studia, ze kterých se nabízí: studio nabídky, studia z lokací herce -
 * a VŠECHNA studia ve stejném městě (zadání 19. 9. 2026: „když nabízíme
 * termíny do Brna, tak můžeme nabídnout obě studia"). Herec, který má
 * v profilu jen Brno I, dostane i Brno II - natáčí se stejně v Brně.
 */
export async function studiaNabidky(studioId: string, actorUserId: string | null, vybrana: string[] = []) {
  const herec = actorUserId
    ? await prisma.user.findUnique({ where: { id: actorUserId }, select: { studioLocations: true } })
    : null;
  const lokace = herec?.studioLocations ?? [];
  const vsechna = await prisma.studio.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    include: { hours: true, presets: { orderBy: { sortOrder: 'asc' } } },
  });
  // Zaskrtnuta studia (19. 9. 2026) maji prednost - produkce vybrala presne.
  if (vybrana.length > 0) {
    const zaskrtnuta = vsechna.filter((s) => vybrana.includes(s.id));
    if (zaskrtnuta.length > 0) return zaskrtnuta;
  }
  const zaklad = vsechna.filter((s) => s.id === studioId || lokace.includes(s.name));
  const mesta = new Set(zaklad.map(mestoStudia));
  return vsechna.filter((s) => mesta.has(mestoStudia(s)));
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

/**
 * Volná místa pro zadané parametry - bez uložené nabídky. Používá ji obnova
 * nabídky i náhled v okně „Vytvořit nabídku termínů" (zadání 19. 9. 2026:
 * „vše by mohlo být přehledně v jednom okně").
 */
export async function volnaMistaProParametry(p: {
  studioId: string;
  studioIds: string[];
  actorUserId: string | null;
  /** „YYYY-MM-DD" */
  od: string;
  doo: string;
  sessionMinutes: number;
  /** Termíny téhle nabídky se za obsazené nepočítají. */
  requestId?: string;
  vlastniDrzene?: { id: string; studioId: string; start: Date; end: Date }[];
}) {
  const studia = await studiaNabidky(p.studioId, p.actorUserId, p.studioIds);
  const ids = studia.map((s) => s.id);
  // Okraje s rezervou den na kazde strane - pasma studii se lisi.
  const rozsahOd = new Date(new Date(`${p.od}T00:00:00.000Z`).getTime() - 24 * 3600 * 1000);
  const rozsahDo = new Date(new Date(`${p.doo}T23:59:59.000Z`).getTime() + 24 * 3600 * 1000);
  const mimoTuto = p.requestId ? { requestId: { not: p.requestId } } : {};

  const [terminy, udalosti, hercovy] = await Promise.all([
    prisma.recordingSlot.findMany({
      where: {
        studioId: { in: ids },
        state: { in: BLOCKING_SLOT_STATES as never },
        ...mimoTuto,
        start: { lt: rozsahDo },
        end: { gt: rozsahOd },
      },
      select: { id: true, studioId: true, start: true, end: true },
    }),
    prisma.studioBlock.findMany({
      where: { studioId: { in: ids }, start: { lt: rozsahDo }, end: { gt: rozsahOd } },
      select: { id: true, studioId: true, start: true, end: true },
    }),
    p.actorUserId
      ? prisma.recordingSlot.findMany({
          where: {
            state: { in: BLOCKING_SLOT_STATES as never },
            ...mimoTuto,
            request: { actorUserId: p.actorUserId },
            start: { lt: rozsahDo },
            end: { gt: rozsahOd },
          },
          select: { id: true, start: true, end: true },
        })
      : Promise.resolve([]),
  ]);

  const drzene = p.vlastniDrzene ?? [];
  const volna = spocitejVolnaMista({
    studia: studia.map((s) => ({ id: s.id, timezone: s.timezone, hours: s.hours, presets: s.presets })),
    od: p.od,
    doo: p.doo,
    delkaMinut: p.sessionMinutes,
    obsazeno: [...terminy, ...udalosti, ...drzene],
    hercovy: [...hercovy, ...drzene],
    nejdrive: zitra(),
  });
  return { volna, studia };
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
      nabizenaStudia: true,
      actorUserId: true,
      periodFrom: true,
      periodTo: true,
      sessionMinutes: true,
      slots: { select: { id: true, studioId: true, start: true, end: true, state: true, note: true } },
    },
  });
  if (!request || !STAVY_S_NABIDKOU.includes(request.status)) return null;

  // Vlastni vybrane a potvrzene terminy teto nabidky taky zabiraji misto -
  // herec nemuze mit ve stejny cas dve frekvence.
  const vlastniDrzene = request.slots.filter((s) => s.state === 'SELECTED' || s.state === 'CONFIRMED');

  const { volna, studia } = await volnaMistaProParametry({
    studioId: request.studioId,
    studioIds: request.nabizenaStudia,
    actorUserId: request.actorUserId,
    od: request.periodFrom.toISOString().slice(0, 10),
    doo: request.periodTo.toISOString().slice(0, 10),
    sessionMinutes: request.sessionMinutes,
    requestId: request.id,
    vlastniDrzene,
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
