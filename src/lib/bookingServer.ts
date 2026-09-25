import { prisma } from '@/lib/db';
import {
  BLOCKING_SLOT_STATES,
  minutesInZone,
  utcParts,
  weekdayInZone,
  zabiraStudio,
  zonedToUtc,
} from '@/lib/calendar';
import { smiStudio, spravovanaStudia, spravujeNeco } from '@/lib/spravaKalendare';
import { zapisZmenuKalendare } from '@/lib/kalendarLogServer';
import { notifyMany } from '@/lib/notifications';
import {
  DRUH_REZERVACE,
  hodinyDne,
  zkontrolujOkno,
  type BookingStudio,
  type BookingUdalost,
  type ChybaRezervace,
} from '@/lib/booking';

/**
 * REZERVACE STUDIA - ČTENÍ A ZÁPIS (zadání 25. 9. 2026). Pravidla a tvary
 * dat jsou v lib/booking.ts, tady je práce s databází.
 *
 * ŽÁDNÁ PARALELNÍ EVIDENCE REZERVACÍ. Rezervace je blokace kalendáře
 * (StudioBlock druhu BOOKING) - tedy tatáž tabulka, ze které se počítá
 * obsazenost studia, konflikty i odběr do Apple kalendáře. Kdyby rezervace
 * ležely vedle, dřív nebo později by se dvě kopie rozešly a někdo by přišel
 * do studia, kde zrovna točíme.
 */

export type BookingPristup = {
  studio: BookingStudio;
  /** Jen kouká (náš tým si kalendář otevírá na zkoušku). */
  jenNahled: boolean;
  /**
   * Smí u tohohle studia měnit nastavení rezervací a zvát klienty
   * (25. 9. 2026: „k té editaci by měl mít přístup i Matěj Černý").
   * Žůžo-labůžo a produkce všude, vedoucí pobočky ve svých studiích.
   */
  spravuje: boolean;
  /** Studia s rezervacemi, na která ten člověk dosáhne - do přepínače. */
  mojeStudia: { id: string; nazev: string }[];
};

/** Studio, do kterého ten člověk patří - i s otevírací dobou. */
export async function nactiBookingStudio(studioId: string): Promise<BookingStudio | null> {
  const studio = await prisma.studio.findUnique({
    where: { id: studioId },
    include: { hours: true },
  });
  if (!studio || !studio.active || !studio.bookingZapnuto) return null;
  return {
    id: studio.id,
    nazev: studio.name,
    kratce: studio.shortName,
    mesto: studio.location,
    barva: studio.color,
    casovePasmo: studio.timezone,
    hodiny: studio.hours
      .map((h) => ({ den: h.weekday, od: h.startMinutes, do: h.endMinutes, poDomluve: h.byArrangement }))
      .sort((a, b) => a.den - b.den),
    minMinut: studio.bookingMinMinut,
    dniDopredu: studio.bookingDniDopredu,
  };
}

/**
 * Kdo se kam smí podívat. Muzikant do svého studia a nikam jinam; náš tým
 * (Žůžo-labůžo a produkce) do kteréhokoliv - ať je vidět, co klient uvidí,
 * aniž by se kdokoliv přihlašoval jeho účtem.
 */
export async function nactiBookingPristup(
  user: { id: string; role: string },
  studioId?: string | null,
): Promise<BookingPristup | null> {
  // Klient studia: jen svoje studio, zato v něm smí rezervovat.
  if (user.role === 'BOOKING') {
    const ucet = await prisma.user.findUnique({
      where: { id: user.id },
      select: { bookingStudioId: true, active: true },
    });
    if (!ucet?.active || !ucet.bookingStudioId) return null;
    const studio = await nactiBookingStudio(ucet.bookingStudioId);
    return studio ? { studio, jenNahled: false, spravuje: false, mojeStudia: [] } : null;
  }

  // Náš tým: Žůžo-labůžo a produkce všude, vedoucí pobočky ve svých studiích
  // (stejné pravidlo jako u kalendáře - viz lib/spravaKalendare.ts).
  const sprava = await spravovanaStudia(user.id, user.role as never);
  if (!spravujeNeco(sprava)) return null;

  const zapnuta = await prisma.studio.findMany({
    where: { active: true, bookingZapnuto: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: { id: true, name: true },
  });
  const moje = zapnuta.filter((s) => smiStudio(sprava, s.id));
  if (moje.length === 0) return null;

  const cil = studioId && moje.some((s) => s.id === studioId) ? studioId : moje[0].id;
  const studio = await nactiBookingStudio(cil);
  if (!studio) return null;
  return {
    studio,
    jenNahled: true,
    spravuje: true,
    mojeStudia: moje.map((s) => ({ id: s.id, nazev: s.name })),
  };
}

/**
 * Smí tenhle člověk u studia měnit nastavení rezervací a zvát klienty?
 * Odpovídá právům na kalendář studia - kdo smí zapisovat do kalendáře
 * pobočky, ten smí i rozhodovat o jejích rezervacích.
 */
export async function smiSpravovatBooking(
  user: { id: string; role: string },
  studioId: string,
): Promise<boolean> {
  if (user.role === 'BOOKING') return false;
  const sprava = await spravovanaStudia(user.id, user.role as never);
  return smiStudio(sprava, studioId);
}

/**
 * Co v daném rozmezí zabírá studio. Vlastní rezervace se vrací se jménem,
 * všechno ostatní bez něj - viz poznámka u BookingUdalost.
 *
 * STŘIH SE NEPOČÍTÁ: dělá se u stolu, ne v kabině (viz zabiraStudio
 * v lib/calendar.ts), takže muzikantovi nic nebere.
 */
export async function nactiBookingUdalosti(
  studioId: string,
  od: Date,
  doKdy: Date,
  userId: string,
): Promise<BookingUdalost[]> {
  const [blokace, terminy] = await Promise.all([
    prisma.studioBlock.findMany({
      where: { studioId, start: { lt: doKdy }, end: { gt: od } },
      orderBy: { start: 'asc' },
      select: {
        id: true,
        start: true,
        end: true,
        kind: true,
        title: true,
        note: true,
        celyDen: true,
        bookingUserId: true,
      },
    }),
    prisma.recordingSlot.findMany({
      where: {
        studioId,
        state: { in: BLOCKING_SLOT_STATES as never },
        start: { lt: doKdy },
        end: { gt: od },
      },
      orderBy: { start: 'asc' },
      select: { id: true, start: true, end: true },
    }),
  ]);

  const udalosti: BookingUdalost[] = [];

  for (const b of blokace) {
    if (!zabiraStudio(b.kind)) continue;
    const moje = b.kind === DRUH_REZERVACE && b.bookingUserId === userId;
    udalosti.push({
      id: b.id,
      start: b.start.toISOString(),
      end: b.end.toISOString(),
      celyDen: b.celyDen,
      moje,
      nazev: moje ? b.title : null,
      poznamka: moje ? b.note : null,
    });
  }

  for (const t of terminy) {
    udalosti.push({
      id: t.id,
      start: t.start.toISOString(),
      end: t.end.toISOString(),
      celyDen: false,
      moje: false,
      nazev: null,
      poznamka: null,
    });
  }

  return udalosti.sort((a, b) => a.start.localeCompare(b.start));
}

// ---------------------------------------------------------------------------
// Založení rezervace
// ---------------------------------------------------------------------------

export type VysledekRezervace =
  | { ok: true; id: string }
  | { ok: false; chyba: ChybaRezervace };

/**
 * Celodenní rezervace = celá otevírací doba toho dne. Není to „od půlnoci do
 * půlnoci": studio v noci zavřené je, a kdyby rezervace sahala přes zavíračku,
 * nedalo by se do ní druhý den nic zapsat.
 */
export function celodenniOkno(
  studio: BookingStudio,
  den: { rok: number; mesic: number; den: number },
): { start: Date; end: Date } | null {
  const poledne = zonedToUtc(den.rok, den.mesic, den.den, 12 * 60, studio.casovePasmo);
  const pravidlo = hodinyDne(studio.hodiny, weekdayInZone(poledne, studio.casovePasmo));
  if (!pravidlo) return null;
  return {
    start: zonedToUtc(den.rok, den.mesic, den.den, pravidlo.od, studio.casovePasmo),
    end: zonedToUtc(den.rok, den.mesic, den.den, pravidlo.do, studio.casovePasmo),
  };
}

/** Kryje se okno s něčím, co už studio drží? */
async function jeObsazeno(studioId: string, start: Date, end: Date): Promise<boolean> {
  const [blok, termin] = await Promise.all([
    prisma.studioBlock.findFirst({
      where: { studioId, start: { lt: end }, end: { gt: start }, kind: { not: 'STRIH' } },
      select: { id: true },
    }),
    prisma.recordingSlot.findFirst({
      where: {
        studioId,
        state: { in: BLOCKING_SLOT_STATES as never },
        start: { lt: end },
        end: { gt: start },
      },
      select: { id: true },
    }),
  ]);
  return Boolean(blok || termin);
}

export async function zalozRezervaci(input: {
  studio: BookingStudio;
  user: { id: string; name: string | null; email: string };
  start: Date;
  end: Date;
  celyDen: boolean;
  nazev: string;
  poznamka?: string | null;
}): Promise<VysledekRezervace> {
  const { studio, start, end } = input;

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    return { ok: false, chyba: 'booking.chybaKratke' };
  }
  if (start.getTime() < Date.now()) return { ok: false, chyba: 'booking.chybaMinulost' };
  if (studio.dniDopredu > 0) {
    const mez = Date.now() + studio.dniDopredu * 24 * 60 * 60 * 1000;
    if (start.getTime() > mez) return { ok: false, chyba: 'booking.chybaDaleko' };
  }

  // Den i minuty v pásmu studia - londýnský kalendář počítá londýnské hodiny.
  const den = weekdayInZone(start, studio.casovePasmo);
  const od = minutesInZone(start, studio.casovePasmo);
  const konec = minutesInZone(end, studio.casovePasmo) === 0 ? 24 * 60 : minutesInZone(end, studio.casovePasmo);
  // Rezervace přes půlnoc neřešíme: studio přes noc zavírá.
  if (konec <= od) return { ok: false, chyba: 'booking.chybaMimoDobu' };
  const chyba = zkontrolujOkno(studio, den, od, konec);
  if (chyba) return { ok: false, chyba };

  if (await jeObsazeno(studio.id, start, end)) {
    return { ok: false, chyba: 'booking.chybaObsazeno' };
  }

  const jmeno = input.user.name?.trim() || input.user.email;
  const blok = await prisma.studioBlock.create({
    data: {
      studioId: studio.id,
      start,
      end,
      kind: DRUH_REZERVACE as never,
      title: input.nazev.trim().slice(0, 160) || jmeno,
      note: input.poznamka?.trim().slice(0, 1000) || null,
      celyDen: input.celyDen,
      bookingUserId: input.user.id,
      bookingName: jmeno,
      bookingEmail: input.user.email,
      createdById: input.user.id,
    },
    select: { id: true, title: true },
  });

  await oznamTymu(studio, {
    nadpis: `Nová rezervace studia ${studio.kratce}`,
    telo: `${jmeno}: ${blok.title}`,
    start,
    end,
  });
  await zapisZmenuKalendare({
    typ: 'BLOK',
    akce: 'VZNIK',
    zaznamId: blok.id,
    nazev: `${blok.title} · ${jmeno}`,
    start,
    end,
    kde: studio.kratce,
    podrobnosti: 'Rezervace z kalendáře studia',
    kdo: { id: input.user.id, jmeno },
  });

  return { ok: true, id: blok.id };
}

/**
 * Zrušení vlastní rezervace. Jen svoje a jen dopředu - co se odehrálo, se
 * z kalendáře nemaže; tým podle toho fakturuje.
 */
export async function zrusRezervaci(
  id: string,
  user: { id: string; name: string | null; email: string },
): Promise<{ ok: true } | { ok: false; chyba: string }> {
  const blok = await prisma.studioBlock.findUnique({
    where: { id },
    select: { id: true, kind: true, bookingUserId: true, start: true, end: true, title: true, studioId: true },
  });
  if (!blok || blok.kind !== DRUH_REZERVACE) return { ok: false, chyba: 'Rezervace nenalezena.' };
  if (blok.bookingUserId !== user.id) return { ok: false, chyba: 'Tohle není vaše rezervace.' };
  if (blok.start.getTime() < Date.now()) return { ok: false, chyba: 'Proběhlou rezervaci zrušit nelze.' };

  const studio = await prisma.studio.findUnique({
    where: { id: blok.studioId },
    select: { shortName: true, vedouci: { select: { id: true } } },
  });

  await prisma.studioBlock.delete({ where: { id } });

  const jmeno = user.name?.trim() || user.email;
  await zapisZmenuKalendare({
    typ: 'BLOK',
    akce: 'ZRUSENI',
    zaznamId: id,
    nazev: `${blok.title} · ${jmeno}`,
    start: blok.start,
    end: blok.end,
    kde: studio?.shortName ?? null,
    podrobnosti: 'Rezervaci zrušil klient studia',
    kdo: { id: user.id, jmeno },
  });
  await notifyMany(
    await kdoHlidaStudio(blok.studioId),
    {
      kind: 'studio-rezervace',
      title: `Zrušená rezervace studia ${studio?.shortName ?? ''}`.trim(),
      body: `${jmeno}: ${blok.title}`,
      url: '/kalendar',
    },
  );

  return { ok: true };
}

/** Komu chodí zprávy o rezervacích: vedoucí studia a Žůžo-labůžo. */
async function kdoHlidaStudio(studioId: string): Promise<string[]> {
  const [studio, admini] = await Promise.all([
    prisma.studio.findUnique({ where: { id: studioId }, select: { vedouci: { select: { id: true } } } }),
    prisma.user.findMany({ where: { role: 'ADMIN', active: true }, select: { id: true } }),
  ]);
  return [...(studio?.vedouci ?? []).map((v) => v.id), ...admini.map((a) => a.id)];
}

async function oznamTymu(
  studio: BookingStudio,
  z: { nadpis: string; telo: string; start: Date; end: Date },
): Promise<void> {
  const kdy = new Intl.DateTimeFormat('cs-CZ', {
    timeZone: studio.casovePasmo,
    day: 'numeric',
    month: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(z.start);
  await notifyMany(await kdoHlidaStudio(studio.id), {
    kind: 'studio-rezervace',
    title: z.nadpis,
    body: `${kdy} — ${z.telo}`,
    url: '/kalendar',
  });
}

/** Dnešek v pásmu studia - odtud se počítá „tenhle týden". */
export function dnesVeStudiu(studio: BookingStudio, ted = new Date()) {
  const p = utcParts(ted, studio.casovePasmo);
  return { rok: p.year, mesic: p.month, den: p.day };
}
