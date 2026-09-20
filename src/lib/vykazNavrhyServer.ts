import { prisma } from '@/lib/db';
import { notify } from '@/lib/notifications';
import { posliPush } from '@/lib/pushServer';

/**
 * NABÍDKA VÝKAZU PO SKONČENÉ PRÁCI (zadání 20. 9. 2026: „nastavit to
 * nabídnutí výkazu zvukařům po skončené frekvenci… nabídnout by to mělo
 * 5 min. před skončením… objeví se to ve zvonečku a ve výkazech + notifikace
 * do aplikace na mobilu, žádný mail").
 *
 * Z kalendáře se berou:
 *  - potvrzené frekvence z nabídky, kde je zvukař doplněný,
 *  - ručně zapsané natáčení, střih a casting se zvukařem.
 *
 * Návrh vznikne 5 minut PŘED koncem - zvukař tak má výkaz po ruce, ještě než
 * vstane od pultu. Jeden zdroj = jeden návrh (`zdroj` je unikátní na
 * uživatele), takže opakované spuštění nic nezdvojí a zapsaný ani odmítnutý
 * návrh se znovu nenabídne.
 *
 * Produkce s tím nemá nic společného (zadání) - je to čistě mezi kalendářem
 * a zvukařem.
 */

/** Kolik minut před koncem práce se výkaz nabídne. */
export const NABIDNOUT_MINUT_PRED_KONCEM = 5;

/**
 * Od kdy se nabízí. Starší práci nikdo dohledávat nechce (zadání: „můžeš to
 * nabízet od zítra"), a bez téhle hranice by se po nasazení vysypaly stovky
 * návrhů za celou historii kalendáře.
 */
export const NABIZET_OD = new Date('2026-09-21T00:00:00.000Z');

/** Druhy událostí kalendáře, ze kterých výkaz vzniká, a jejich druh práce. */
const DRUH_PRACE: Record<string, 'RECORDING' | 'EDITING'> = {
  NATACENI: 'RECORDING',
  CASTING: 'RECORDING',
  STRIH: 'EDITING',
};

export type NavrhProZvukare = {
  id: string;
  start: string;
  end: string;
  workType: 'RECORDING' | 'EDITING' | 'OTHER';
  caflouProjectId: string | null;
  projectName: string | null;
  studioName: string | null;
  actorName: string | null;
};

function hraniceCasu(ted: Date): Date {
  return new Date(ted.getTime() + NABIDNOUT_MINUT_PRED_KONCEM * 60000);
}

/**
 * Projde kalendář a doplní chybějící návrhy. Vrací nově založené - o těch se
 * dává vědět. Dá se pustit pro jednoho zvukaře (otevřel si Výkazy) i pro
 * všechny (úloha každých 5 minut).
 */
export async function pripravNavrhy(userId?: string): Promise<{ nove: number; ids: string[] }> {
  const ted = new Date();
  const doKdy = hraniceCasu(ted);
  const cas = { start: { gte: NABIZET_OD }, end: { lte: doKdy } };

  const [sloty, bloky] = await Promise.all([
    prisma.recordingSlot.findMany({
      where: {
        state: 'CONFIRMED',
        zvukarUserId: userId ? userId : { not: null },
        ...cas,
      },
      select: {
        id: true,
        start: true,
        end: true,
        zvukarUserId: true,
        studio: { select: { shortName: true, name: true } },
        request: { select: { projectName: true, actorName: true, caflouProjectId: true } },
      },
      take: 500,
    }),
    prisma.studioBlock.findMany({
      where: {
        kind: { in: ['NATACENI', 'STRIH', 'CASTING'] },
        zvukarUserId: userId ? userId : { not: null },
        ...cas,
      },
      select: {
        id: true,
        kind: true,
        start: true,
        end: true,
        zvukarUserId: true,
        caflouProjectId: true,
        projectName: true,
        actorName: true,
        studio: { select: { shortName: true, name: true } },
      },
      take: 500,
    }),
  ]);

  const kratce = (s: { shortName: string | null; name: string } | null) =>
    s ? (s.shortName ?? s.name.split(' - ').pop() ?? s.name).trim() : null;

  const navrhy = [
    ...sloty.map((s) => ({
      userId: s.zvukarUserId!,
      zdroj: `slot:${s.id}`,
      start: s.start,
      end: s.end,
      workType: 'RECORDING' as const,
      caflouProjectId: s.request.caflouProjectId ?? null,
      projectName: s.request.projectName ?? null,
      studioName: kratce(s.studio),
      actorName: s.request.actorName ?? null,
    })),
    ...bloky.map((b) => ({
      userId: b.zvukarUserId!,
      zdroj: `blok:${b.id}`,
      start: b.start,
      end: b.end,
      workType: DRUH_PRACE[b.kind] ?? ('RECORDING' as const),
      caflouProjectId: b.caflouProjectId,
      projectName: b.projectName,
      studioName: kratce(b.studio),
      actorName: b.actorName,
    })),
  ];

  const ids: string[] = [];
  for (const n of navrhy) {
    try {
      // Uz existujici navrh se nepřepisuje - zvukar uz ho treba odmitl nebo
      // si v nem opravil cas.
      const uz = await prisma.navrhVykazu.findUnique({
        where: { userId_zdroj: { userId: n.userId, zdroj: n.zdroj } },
        select: { id: true },
      });
      if (uz) continue;
      const vytvoreny = await prisma.navrhVykazu.create({ data: n, select: { id: true } });
      ids.push(vytvoreny.id);
    } catch (err) {
      console.error('Návrh výkazu se nepodařilo založit:', err);
    }
  }

  return { nove: ids.length, ids };
}

/** Čekající návrhy jednoho zvukaře, od nejnovějšího. */
export async function nactiNavrhy(userId: string): Promise<NavrhProZvukare[]> {
  try {
    const radky = await prisma.navrhVykazu.findMany({
      where: { userId, stav: 'CEKA' },
      orderBy: { start: 'desc' },
      take: 50,
    });
    return radky.map((n) => ({
      id: n.id,
      start: n.start.toISOString(),
      end: n.end.toISOString(),
      workType: n.workType,
      caflouProjectId: n.caflouProjectId,
      projectName: n.projectName,
      studioName: n.studioName,
      actorName: n.actorName,
    }));
  } catch (err) {
    console.error('Návrhy výkazů se nepodařilo načíst:', err);
    return [];
  }
}

const PRAHA = 'Europe/Prague';

function kdy(start: Date, end: Date): string {
  const den = new Intl.DateTimeFormat('cs-CZ', {
    timeZone: PRAHA,
    weekday: 'short',
    day: 'numeric',
    month: 'numeric',
  }).format(start);
  const cas = (d: Date) =>
    new Intl.DateTimeFormat('cs-CZ', { timeZone: PRAHA, hour: 'numeric', minute: '2-digit' }).format(d);
  return `${den} ${cas(start)}–${cas(end)}`;
}

/**
 * Dá zvukařům vědět o návrzích, o kterých ještě nevědí: zvoneček v portálu
 * a upozornění do telefonu. ŽÁDNÝ E-MAIL (zadání 20. 9. 2026).
 */
export async function oznamNavrhy(): Promise<{ oznameno: number }> {
  let oznameno = 0;
  try {
    const cekajici = await prisma.navrhVykazu.findMany({
      where: { stav: 'CEKA', oznamenoAt: null },
      orderBy: { start: 'asc' },
      take: 200,
    });
    if (cekajici.length === 0) return { oznameno: 0 };

    // Po zvukarich - kdyz skonci dve veci naraz, prijde jedno upozorneni.
    const podleZvukare = new Map<string, typeof cekajici>();
    for (const n of cekajici) {
      const seznam = podleZvukare.get(n.userId) ?? [];
      seznam.push(n);
      podleZvukare.set(n.userId, seznam);
    }

    for (const [userId, seznam] of podleZvukare) {
      const prvni = seznam[0];
      const nazev = prvni.projectName ?? (prvni.workType === 'EDITING' ? 'Střih' : 'Natáčení');
      const titulek = seznam.length === 1 ? 'Přidejte si výkaz' : `Přidejte si výkaz (${seznam.length}×)`;
      const text =
        seznam.length === 1
          ? `${nazev} · ${kdy(prvni.start, prvni.end)}${prvni.studioName ? ` · ${prvni.studioName}` : ''}`
          : `${nazev} a další · ${kdy(prvni.start, prvni.end)}`;

      await notify({ userId, kind: 'vykaz-navrh', title: titulek, body: text, url: '/vykazy' });
      await posliPush([userId], {
        titulek,
        text,
        odkaz: '/vykazy',
        // Nova nabidka prepise tu predchozi, at se na zamcene obrazovce
        // nekupi sloupec upozorneni.
        znacka: 'vykaz-navrh',
      });
      await prisma.navrhVykazu.updateMany({
        where: { id: { in: seznam.map((n) => n.id) } },
        data: { oznamenoAt: new Date() },
      });
      oznameno += seznam.length;
    }
  } catch (err) {
    console.error('Upozornění na návrhy výkazů selhalo:', err);
  }
  return { oznameno };
}

/** Celý běh úlohy: doplnit návrhy a dát o nich vědět. */
export async function zpracujNavrhyVykazu(): Promise<{ nove: number; oznameno: number }> {
  const { nove } = await pripravNavrhy();
  const { oznameno } = await oznamNavrhy();
  return { nove, oznameno };
}
