import { prisma } from '@/lib/db';
import { posliPush } from '@/lib/pushServer';
import { nactiPorady } from '@/lib/poradyServer';
import { minutesInZone, minutesToTime, utcParts, zonedToUtc } from '@/lib/calendar';
import { INTERNAL_ROLES } from '@/lib/roles';
import { oznacRezii } from '@/lib/rezieOnlineServer';

/**
 * PŘEHLED DNE (zadání 23. 9. 2026: „chtěl bych, aby mi Bruno
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
 * KAM SE DORUČUJE (upřesnění 23. 9. 2026: „ne tak, že mi to napíše Bruno do
 * chatu, ale že se mi v portálu otevře průhledné vyskakovací okno a tam to
 * bude. A do aplikace na mobilu mi přijde notifikace").
 *
 * Ráno v sedm odejde jen UPOZORNĚNÍ DO TELEFONU. Samotný přehled čeká
 * v portálu: jakmile ho člověk otevře, vyskočí okno (viz komponenta
 * PrehledDne a /api/prehled-dne) a po zavření se do večera neukáže znovu.
 * Do chatu se nepíše nic - zpráva tam zapadla mezi ostatní.
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
      const udalosti = await udalostiCloveka(clovek.id, zacatekDne, konecDne);
      const prvni = udalosti[0];
      await posliPush([clovek.id], {
        titulek: 'Dnešní program',
        text: prvni
          ? `${udalosti.length === 1 ? '' : `${udalosti.length} události, první `}${prvni.cas} — ${prvni.popis}`
          : 'V kalendáři dnes nic vašeho nemám.',
        odkaz: '/kalendar',
        znacka: 'prehled-dne',
      });
      // Razítko je zároveň značka „na dnešek už je hotovo" - i pro okno
      // v portálu, které se otevře, až se člověk přihlásí.
      await prisma.user.update({
        where: { id: clovek.id },
        data: { ranniPrehledAt: new Date() },
      });
      odeslano += 1;
    } catch (err) {
      console.error(`Ranni prehled pro ${clovek.email} selhal:`, err);
      preskoceno += 1;
    }
  }

  return { odeslano, preskoceno };
}

/**
 * PŘEHLED DNE PRO OKNO V PORTÁLU (23. 9. 2026) - data, ne text, ať se dají
 * vykreslit ikony a barvy. Text pro chat skládá slozPrehled níž ze stejného
 * základu.
 */
export type PrehledDneData = {
  /** „Čtvrtek 24. 9." */
  den: string;
  udalosti: {
    cas: string;
    druh: DruhUdalosti;
    nazev: string;
    detail: string | null;
    studio: string | null;
    rezie: boolean;
  }[];
  ukoly: { text: string; cas: string | null }[];
};

export async function prehledDneData(userId: string, kdy: Date): Promise<PrehledDneData> {
  const p = utcParts(kdy, PASMO);
  const od = zonedToUtc(p.year, p.month, p.day, 0, PASMO);
  const doKdy = zonedToUtc(p.year, p.month, p.day + 1, 0, PASMO);

  const [udalosti, ukoly] = await Promise.all([
    udalostiCloveka(userId, od, doKdy),
    prisma.task
      .findMany({
        where: { userId, done: false, dueDate: { gte: od, lt: doKdy } },
        orderBy: [{ dueDate: 'asc' }, { sortOrder: 'asc' }],
        take: 20,
      })
      .catch(() => []),
  ]);

  const datum = new Intl.DateTimeFormat('cs-CZ', {
    timeZone: PASMO,
    weekday: 'long',
    day: 'numeric',
    month: 'numeric',
  }).format(od);

  return {
    den: `${datum[0].toLocaleUpperCase('cs')}${datum.slice(1)}`,
    udalosti: udalosti.map((u) => ({
      cas: u.cas,
      druh: u.druh,
      nazev: u.nazev,
      detail: u.detail,
      studio: u.studio,
      rezie: u.rezie,
    })),
    ukoly: ukoly.map((u) => ({ text: u.title, cas: u.dueTime || null })),
  };
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

/** Jedna položka programu - z ní se skládá text i připomínka 15 minut předem. */
export type DruhUdalosti = 'NATACENI' | 'STRIH' | 'CASTING' | 'PORADA' | 'SCHUZKA' | 'JINE';

export type UdalostCloveka = {
  /** Klíč pro připomínku, ať nechodí dvakrát: `<typ>:<id>`. */
  klic: string;
  start: Date;
  end: Date;
  /** „9:00–13:00" */
  cas: string;
  /** Jednořádkový popis do textu (chat, připomínka). */
  popis: string;
  /** Druh - podle něj se v okně vykreslí ikona (23. 9. 2026). */
  druh: DruhUdalosti;
  /** Hlavní název - projekt, porada, blokace. */
  nazev: string;
  /** Druhý řádek: herec, účastníci, poznámka. */
  detail: string | null;
  /** Zkratka studia, když se událost děje ve studiu. */
  studio: string | null;
  /** Červený rámeček a telefon - první frekvence s hercem a castingy. */
  rezie: boolean;
};

/**
 * CO MÁ ČLOVĚK V ROZSAHU - společný základ přehledu i připomínek
 * (23. 9. 2026). Text se z toho skládá níž; připomínka 15 minut předem si
 * bere tytéž položky, aby se obojí nemohlo rozejít.
 */
export async function udalostiCloveka(userId: string, od: Date, doKdy: Date): Promise<UdalostCloveka[]> {
  const clovek = await prisma.user
    .findUnique({ where: { id: userId }, select: { rezieNaDalku: true, role: true } })
    .catch(() => null);

  const [sloty, bloky, porady] = await Promise.all([
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
    // Role se posílá schválně: kalendář Schůzky vidí Žůžo-labůžo a produkce
    // celý, ne jen to, na co jsou pozvaní (upřesnění 23. 9. 2026).
    nactiPorady(userId, od, doKdy, clovek?.role).catch(() => []),
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

  const znacka = (id: string) => (sRezii.has(id) ? ' · režie na dálku' : '');

  const druhBloku = (kind: string): DruhUdalosti =>
    kind === 'NATACENI' || kind === 'STRIH' || kind === 'CASTING' ? (kind as DruhUdalosti) : 'JINE';

  const udalosti: UdalostCloveka[] = [
    ...mojeSloty.map((s) => ({
      klic: `slot:${s.id}`,
      start: s.start,
      end: s.end,
      cas: `${cas(s.start)}–${cas(s.end)}`,
      popis: `${s.request.projectName} · ${s.request.actorName} (${s.studio.shortName})${znacka(s.id)}`,
      druh: 'NATACENI' as DruhUdalosti,
      nazev: s.request.projectName,
      detail: s.request.actorName,
      studio: s.studio.shortName,
      rezie: sRezii.has(s.id),
    })),
    ...mojeBloky.map((b) => ({
      klic: `blok:${b.id}`,
      start: b.start,
      end: b.end,
      cas: `${cas(b.start)}–${cas(b.end)}`,
      popis: `${b.title} (${b.studio.shortName})${znacka(b.id)}`,
      druh: druhBloku(String(b.kind)),
      nazev: b.title,
      detail: b.actorName ?? null,
      studio: b.studio.shortName,
      rezie: sRezii.has(b.id),
    })),
    ...porady.map((p) => ({
      klic: `porada:${p.poradaId}:${p.den}`,
      start: new Date(p.start),
      end: new Date(p.end),
      cas: `${cas(new Date(p.start))}–${cas(new Date(p.end))}`,
      popis: `${p.nazev} (${p.druh === 'SCHUZKA' ? 'schůzka' : 'porada'})`,
      druh: (p.druh === 'SCHUZKA' ? 'SCHUZKA' : 'PORADA') as DruhUdalosti,
      nazev: p.nazev,
      detail: p.ucastnici.map((u) => u.label).join(', ') || null,
      studio: null,
      rezie: false,
    })),
  ].sort((a, b) => a.start.getTime() - b.start.getTime());

  return udalosti;
}

/** Text přehledu. Když není nic, řekne se to - prázdná zpráva mate. */
async function slozPrehled(
  userId: string,
  od: Date,
  doKdy: Date,
  volby: { pozdrav?: boolean } = {},
): Promise<string> {
  const [udalosti, ukoly] = await Promise.all([
    udalostiCloveka(userId, od, doKdy),
    /**
     * JEN ÚKOLY NA TEN DEN (upřesnění 23. 9. 2026: „úkoly bych zobrazoval jen
     * ty, které mají dnešní datum. Dlouhodobé ne"). Úkoly bez termínu ani ty
     * s termínem jindy do přehledu dne nepatří - od toho je to-do list.
     */
    prisma.task
      .findMany({
        where: { userId, done: false, dueDate: { gte: od, lt: doKdy } },
        orderBy: [{ dueDate: 'asc' }, { sortOrder: 'asc' }],
        take: 20,
      })
      .catch(() => []),
  ]);

  const radky: string[] = [];
  const datum = new Intl.DateTimeFormat('cs-CZ', {
    timeZone: PASMO,
    weekday: 'long',
    day: 'numeric',
    month: 'numeric',
  }).format(od);
  radky.push(volby.pozdrav === false ? `${datum[0].toLocaleUpperCase('cs')}${datum.slice(1)}:` : `Dobré ráno, tady je ${datum}.`);

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
