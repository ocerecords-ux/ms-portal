import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { buildIcs, type IcsEvent } from '@/lib/ics';
import { canViewCalendar } from '@/lib/roles';
import { BLOCK_KIND_LABELS } from '@/lib/calendar';
import { popisDruhu } from '@/lib/nepritomnost';

/**
 * ODBĚR KALENDÁŘE MS PORTALU (zadání 8. 9. 2026, rozšířeno 20. 9. 2026:
 * „potřebuju, aby si můj tým jednoduše přidal MS kalendář do svých
 * nativních kalendářů, např. Google nebo Apple. Jen pro čtení").
 *
 * Odkaz je náhodný, odvolatelný a nese jen to, na co má jeho VLASTNÍK právo.
 * Kalendář v telefonu je jen ke čtení - měnit se dá výhradně v portálu.
 *
 * Co jde ven (pro tým):
 *  - potvrzená natáčení s hercem (i se zvukařem a poznámkou),
 *  - ručně zapsané události studia: natáčení, střih, svátek, údržba…,
 *  - Mimo studio (dovolené) - u celého kalendáře všech, u „Jen moje" svoje.
 * Nabídky a vybrané, ale nepotvrzené termíny ven nejdou.
 *
 * Rozsah: 60 dní zpátky, rok dopředu - kalendář v telefonu to stahuje
 * pořád dokola, celá historie by ho jen zpomalovala.
 */
export const dynamic = 'force-dynamic';

const DNI_ZPET = 60;
const DNI_DOPREDU = 366;

export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  // Kalendare obcas pridaji priponu .ics - at odkaz funguje s ni i bez ni.
  const token = params.token.replace(/\.ics$/i, '');
  const feed = await prisma.calendarFeed.findUnique({
    where: { token },
    include: {
      user: { select: { id: true, name: true, email: true, role: true, active: true } },
      studio: { select: { id: true, name: true, location: true, color: true } },
    },
  });

  if (!feed || feed.revokedAt || !feed.user.active) {
    return new NextResponse('Odkaz už neplatí.', { status: 404 });
  }

  // Prava se ctou z VLASTNIKA odkazu, ne z odkazu samotneho - kdyz nekomu
  // mezitim skonci role, prestane odkaz vydavat i data.
  const kdo = feed.user;
  const tym = canViewCalendar(kdo.role);
  const jenMoje = feed.scope === 'MINE' || !tym;
  const studioId = !jenMoje && feed.scope === 'STUDIO' ? feed.studioId : null;

  const od = new Date(Date.now() - DNI_ZPET * 86400000);
  const doo = new Date(Date.now() + DNI_DOPREDU * 86400000);
  const vRozsahu = { start: { lt: doo }, end: { gt: od } };

  // Herec: jen sve potvrzene frekvence (to, co mel odkaz vzdycky).
  if (!tym) {
    const slots = await prisma.recordingSlot.findMany({
      where: { state: 'CONFIRMED', request: { actorUserId: kdo.id }, ...vRozsahu },
      orderBy: { start: 'asc' },
      include: {
        studio: { select: { name: true, location: true } },
        request: { select: { projectName: true } },
      },
    });
    const events: IcsEvent[] = slots.map((s) => ({
      uid: `slot-${s.id}@msportal.cz`,
      start: s.start,
      end: s.end,
      summary: s.request.projectName,
      description: `Natáčení — ${s.request.projectName}`,
      location: [s.studio.name, s.studio.location].filter(Boolean).join(', '),
      updatedAt: s.updatedAt,
    }));
    return odpoved(`MS portal — ${kdo.name || kdo.email}`, events, feed.id);
  }

  // Jen Mimo studio (20. 9. 2026: „aby se to objevilo jako samostatné
  // kalendáře, ať si dokážu vypínat jednotlivé kalendáře") - pátý kalendář
  // vedle čtyř studií, jen dovolené a nepřítomnosti celého týmu.
  if (feed.scope === 'MIMO') {
    const mimo = await prisma.nepritomnost
      .findMany({ where: vRozsahu, orderBy: { start: 'asc' } })
      .catch(() => []);
    return odpoved(
      'MS kalendář — Mimo studio',
      mimo.map((n) => ({
        uid: `mimo-${n.id}@msportal.cz`,
        start: n.start,
        end: n.end,
        celyDen: n.celyDen,
        summary: `${popisDruhu(n.druh)}: ${n.jmeno}`,
        description: n.poznamka,
        updatedAt: n.updatedAt,
      })),
      feed.id,
      '#A7A4B0',
    );
  }

  const [slots, bloky, nepritomnosti] = await Promise.all([
    prisma.recordingSlot.findMany({
      where: {
        state: 'CONFIRMED',
        ...vRozsahu,
        ...(studioId ? { studioId } : {}),
        // „Jen moje" u tymu = kde jsem zvukar.
        ...(jenMoje ? { zvukarUserId: kdo.id } : {}),
      },
      orderBy: { start: 'asc' },
      include: {
        studio: { select: { name: true, location: true } },
        request: { select: { projectName: true, actorName: true } },
      },
    }),
    prisma.studioBlock.findMany({
      where: {
        ...vRozsahu,
        ...(studioId ? { studioId } : {}),
        ...(jenMoje ? { OR: [{ zvukarUserId: kdo.id }, { createdById: kdo.id, kind: { in: ['NATACENI', 'STRIH', 'CASTING'] } }] } : {}),
      },
      orderBy: { start: 'asc' },
      include: { studio: { select: { name: true, location: true } } },
    }),
    // Mimo studio: u jednoho studia ne (neni ke studiu vazane).
    studioId
      ? Promise.resolve([])
      : prisma.nepritomnost
          .findMany({ where: { ...vRozsahu, ...(jenMoje ? { userId: kdo.id } : {}) }, orderBy: { start: 'asc' } })
          .catch(() => []),
  ]);

  const kratce = (nazev: string) => (nazev.split(' - ').pop() ?? nazev).trim();

  /**
   * CO NEJMÍŇ TEXTU (zadání 21. 9. 2026: „když si zobrazuju v Apple kalendáři,
   * tak tam chci posílat co nejmíň věcí. Hlavně ať je tam název projektu, čas,
   * jméno zvukaře, jméno herce. Teď tam je dvakrát střih a adresa a studio je
   * zbytečné").
   *
   * Název události = jen to podstatné, oddělené tečkou:
   *   natáčení  →  Projekt · Herec · Zvukař
   *   střih     →  Střih · Projekt · Zvukař   (bez projektu jen Střih · Zvukař)
   *   casting   →  Casting · Herec · Zvukař
   * Čas ukazuje kalendář sám. Studio ani adresa se neposílají - každé studio
   * je v telefonu vlastní kalendář s vlastní barvou. Popis nese jen poznámku,
   * a to jen když nějaká je.
   */
  const spoj = (casti: (string | null | undefined)[]) =>
    casti.map((c) => (c ?? '').trim()).filter(Boolean).join(' · ');

  const events: IcsEvent[] = [
    ...slots.map((s) => ({
      uid: `slot-${s.id}@msportal.cz`,
      start: s.start,
      end: s.end,
      summary: spoj([s.request.projectName, s.request.actorName, s.zvukarName]),
      description: s.note || null,
      updatedAt: s.updatedAt,
    })),
    ...bloky.map((b) => {
      const druh = BLOCK_KIND_LABELS[b.kind] ?? 'Blokace';
      const summary =
        b.kind === 'NATACENI'
          ? spoj([b.projectName || druh, b.actorName, b.zvukarName])
          : b.kind === 'STRIH'
            ? spoj([druh, b.projectName, b.zvukarName])
            : b.kind === 'CASTING'
              ? spoj([druh, b.actorName, b.zvukarName])
              : // Údržba, svátek, porada… - stačí, co to je.
                b.title || druh;
      return {
        uid: `blok-${b.id}@msportal.cz`,
        start: b.start,
        end: b.end,
        summary,
        description: b.note || null,
        updatedAt: b.updatedAt,
      };
    }),
    ...nepritomnosti.map((n) => ({
      uid: `mimo-${n.id}@msportal.cz`,
      start: n.start,
      end: n.end,
      celyDen: n.celyDen,
      summary: `${popisDruhu(n.druh)}: ${n.jmeno}`,
      description: n.poznamka,
      updatedAt: n.updatedAt,
    })),
  ];

  const nazev = jenMoje
    ? `MS kalendář — ${kdo.name || kdo.email}`
    : feed.studio
      ? `MS kalendář — ${kratce(feed.studio.name)}`
      : 'MS kalendář';

  return odpoved(nazev, events, feed.id, feed.studio?.color ?? null);
}

async function odpoved(nazev: string, events: IcsEvent[], feedId: string, barva?: string | null) {
  await prisma.calendarFeed.update({ where: { id: feedId }, data: { lastReadAt: new Date() } }).catch(() => null);
  return new NextResponse(buildIcs(nazev, events, barva), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="ms-kalendar.ics"',
      // Kalendare si stahuji soubor opakovane - at nekesuji stary obsah.
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}
