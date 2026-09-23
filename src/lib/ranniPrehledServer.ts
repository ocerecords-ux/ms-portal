import { prisma } from '@/lib/db';
import { brunoNapisSoukrome } from '@/lib/brunoOznameni';
import { nactiPorady } from '@/lib/poradyServer';
import { minutesInZone, minutesToTime, utcParts, zonedToUtc } from '@/lib/calendar';
import { INTERNAL_ROLES } from '@/lib/roles';
import { oznacRezii } from '@/lib/rezieOnlineServer';

/**
 * RANNÍ PŘEHLED OD BRUNA (zadání 23. 9. 2026: „chtěl bych, aby mi Bruno
 * sesumíroval události na daný den. Vždycky ať mi to pošle v sedm ráno na
 * daný den události, které se mě týkají. Případně i úkoly, co mám.").
 *
 * Co se do přehledu počítá jako „moje":
 *  - natáčení, kde jsem herec nebo zvukař (termín z nabídky i ručně zapsaná
 *    událost v kalendáři),
 *  - události s REŽIÍ NA DÁLKU, když na ně chodím (User.rezieNaDalku,
 *    zadání 23. 9. 2026: „mě se týkají jen ty režie online a porady
 *    a schůzky"),
 *  - porady, na které jsem pozvaný,
 *  - otevřené úkoly na dnešek a všechno, co je po termínu.
 *
 * Posílá se do SOUKROMÉHO CHATU S BRUNEM - je to zpráva, ne mail, takže se
 * dá rovnou odpovědět a nezahltí to schránku. Zapíná se v Můj účet.
 *
 * ČAS: cron běží v UTC, tohle si hlídá, že je v Praze zrovna sedmá - jinak
 * by se přehled v zimě a v létě rozešel o hodinu. Odeslání se poznamená
 * (User.ranniPrehledAt), takže i kdyby úloha běžela dvakrát, zpráva odejde
 * jednou.
 */

const PASMO = 'Europe/Prague';
const HODINA = 7;

export type VysledekRanniPrehled = { odeslano: number; preskoceno: number };

function den(d: Date): string {
  const p = utcParts(d, PASMO);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

function cas(d: Date): string {
  return minutesToTime(minutesInZone(d, PASMO));
}

export async function posliRanniPrehledy(options: { vynutit?: boolean } = {}): Promise<VysledekRanniPrehled> {
  const ted = new Date();
  const dnesek = utcParts(ted, PASMO);
  if (!options.vynutit && dnesek.hour !== HODINA) return { odeslano: 0, preskoceno: 0 };

  const zacatekDne = zonedToUtc(dnesek.year, dnesek.month, dnesek.day, 0, PASMO);
  const konecDne = zonedToUtc(dnesek.year, dnesek.month, dnesek.day + 1, 0, PASMO);

  const lide = await prisma.user
    .findMany({
      where: { active: true, ranniPrehled: true, role: { in: INTERNAL_ROLES as never } },
      select: { id: true, name: true, email: true, ranniPrehledAt: true },
    })
    .catch(() => []);

  let odeslano = 0;
  let preskoceno = 0;

  for (const clovek of lide) {
    // Dneska už přehled odešel - podruhé se neposílá.
    if (!options.vynutit && clovek.ranniPrehledAt && den(clovek.ranniPrehledAt) === den(ted)) {
      preskoceno += 1;
      continue;
    }
    try {
      const text = await slozPrehled(clovek.id, zacatekDne, konecDne);
      const ok = await brunoNapisSoukrome(clovek.id, text);
      if (!ok) {
        preskoceno += 1;
        continue;
      }
      await prisma.user.update({ where: { id: clovek.id }, data: { ranniPrehledAt: new Date() } });
      odeslano += 1;
    } catch (err) {
      console.error(`Ranni prehled pro ${clovek.email} selhal:`, err);
      preskoceno += 1;
    }
  }

  return { odeslano, preskoceno };
}

/**
 * Přehled na libovolný den - tenhle text umí Bruno poslat i na vyžádání
 * v chatu (zadání 23. 9. 2026: „když se ho zeptám v chatu na daný den, tak
 * mi to řekne, co tam mám").
 */
export async function prehledNaDen(userId: string, kdy: Date): Promise<string> {
  const p = utcParts(kdy, PASMO);
  const od = zonedToUtc(p.year, p.month, p.day, 0, PASMO);
  const doKdy = zonedToUtc(p.year, p.month, p.day + 1, 0, PASMO);
  return slozPrehled(userId, od, doKdy, { pozdrav: false });
}

/** Text přehledu. Když není nic, řekne se to - prázdná zpráva mate. */
async function slozPrehled(
  userId: string,
  od: Date,
  doKdy: Date,
  volby: { pozdrav?: boolean } = {},
): Promise<string> {
  const clovek = await prisma.user
    .findUnique({ where: { id: userId }, select: { rezieNaDalku: true } })
    .catch(() => null);

  const [sloty, bloky, porady, ukoly] = await Promise.all([
    prisma.recordingSlot
      .findMany({
        where: {
          state: { in: ['SELECTED', 'CONFIRMED'] as never },
          start: { lt: doKdy },
          end: { gt: od },
          // Režie na dálku znamená „všechno, co ten den jede" - ze seznamu
          // se pak nechá jen to s ikonou režie (viz níž).
          ...(clovek?.rezieNaDalku ? {} : { OR: [{ zvukarUserId: userId }, { request: { actorUserId: userId } }] }),
        },
        include: {
          studio: { select: { shortName: true } },
          request: { select: { projectName: true, actorName: true, caflouProjectId: true, actorUserId: true } },
        },
        orderBy: { start: 'asc' },
      })
      .catch(() => []),
    prisma.studioBlock
      .findMany({
        where: {
          start: { lt: doKdy },
          end: { gt: od },
          ...(clovek?.rezieNaDalku ? {} : { OR: [{ zvukarUserId: userId }, { actorUserId: userId }] }),
        },
        include: { studio: { select: { shortName: true } } },
        orderBy: { start: 'asc' },
      })
      .catch(() => []),
    nactiPorady(userId, od, doKdy).catch(() => []),
    prisma.task
      .findMany({
        where: { userId, done: false, OR: [{ dueDate: { lt: doKdy } }, { dueDate: null }] },
        orderBy: [{ dueDate: 'asc' }, { sortOrder: 'asc' }],
        take: 20,
      })
      .catch(() => []),
  ]);

  /**
   * REŽIE NA DÁLKU (23. 9. 2026). Kdo na ni chodí, má v přehledu i události,
   * kde není zvukař ani herec - právě ty, u kterých v kalendáři svítí
   * telefon (první frekvence s hercem a každý casting).
   */
  const sRezii = clovek?.rezieNaDalku
    ? await oznacRezii([
        ...sloty.map((s) => ({
          id: s.id,
          caflouProjectId: s.request.caflouProjectId,
          actorUserId: s.request.actorUserId,
          actorName: s.request.actorName,
          rezieOnline: s.rezieOnline,
        })),
        ...bloky
          .filter((b) => b.kind === 'NATACENI' || b.kind === 'CASTING')
          .map((b) => ({
            id: b.id,
            caflouProjectId: b.caflouProjectId,
            actorUserId: b.actorUserId,
            actorName: b.actorName,
            rezieOnline: b.rezieOnline,
            vzdy: b.kind === 'CASTING',
          })),
      ]).catch(() => new Set<string>())
    : new Set<string>();

  const mojeSloty = sloty.filter(
    (s) => !clovek?.rezieNaDalku || sRezii.has(s.id) || s.zvukarUserId === userId || s.request.actorUserId === userId,
  );
  const mojeBloky = bloky.filter(
    (b) => !clovek?.rezieNaDalku || sRezii.has(b.id) || b.zvukarUserId === userId || b.actorUserId === userId,
  );

  const radky: string[] = [];
  const datum = new Intl.DateTimeFormat('cs-CZ', {
    timeZone: PASMO,
    weekday: 'long',
    day: 'numeric',
    month: 'numeric',
  }).format(od);
  radky.push(volby.pozdrav === false ? `${datum[0].toLocaleUpperCase('cs')}${datum.slice(1)}:` : `Dobré ráno, tady je ${datum}.`);

  const znacka = (id: string) => (sRezii.has(id) ? ' · režie na dálku' : '');

  const udalosti: { cas: string; popis: string }[] = [
    ...mojeSloty.map((s) => ({
      cas: `${cas(s.start)}–${cas(s.end)}`,
      popis: `${s.request.projectName} · ${s.request.actorName} (${s.studio.shortName})${znacka(s.id)}`,
    })),
    ...mojeBloky.map((b) => ({
      cas: `${cas(b.start)}–${cas(b.end)}`,
      popis: `${b.title} (${b.studio.shortName})${znacka(b.id)}`,
    })),
    ...porady.map((p) => ({
      cas: `${cas(new Date(p.start))}–${cas(new Date(p.end))}`,
      popis: `${p.nazev} (porada)`,
    })),
  ].sort((a, b) => a.cas.localeCompare(b.cas));

  radky.push('');
  if (udalosti.length === 0) {
    radky.push('V kalendáři ten den nic vašeho nemám.');
  } else {
    radky.push('Čeká vás:');
    for (const u of udalosti) radky.push(`• ${u.cas} — ${u.popis}`);
  }

  if (ukoly.length > 0) {
    radky.push('');
    radky.push('Úkoly:');
    for (const u of ukoly) {
      const termin = u.dueDate
        ? ` (do ${new Intl.DateTimeFormat('cs-CZ', { timeZone: PASMO, day: 'numeric', month: 'numeric' }).format(u.dueDate)}${u.dueTime ? ` ${u.dueTime}` : ''})`
        : '';
      radky.push(`• ${u.title}${termin}`);
    }
  }

  return radky.join('\n');
}
