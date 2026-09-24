import { prisma } from '@/lib/db';
import { minutesInZone, minutesToTime } from '@/lib/calendar';
import { udalostiCloveka } from '@/lib/ranniPrehledServer';
import { canViewCalendar } from '@/lib/roles';
import { DNU_KONFLIKTU } from '@/lib/konflikty';
import { bezTitulu } from '@/lib/jmena';
import type { Role } from '@prisma/client';

/**
 * KONFLIKTY V KALENDÁŘI (zadání 23. 9. 2026: „systém by měl hlídat konflikty
 * v kalendáři. Teď jsem třeba jeden objevil. Zítra mám casting a online
 * schůzku zároveň").
 *
 * DVA DRUHY, SCHVÁLNĚ ODDĚLENÉ (upřesnění: „rozdělil bych své události a
 * ostatní, které se týkají mě a natáčení. Mé konflikty zobrazuj jen mi
 * a zbytek všem"):
 *
 *  - MOJE: co se překrývá mně osobně - casting a schůzka naráz, porada přes
 *    natáčení. Vidím je JEN JÁ; nikoho jiného nezajímá, že mám plno.
 *  - PROVOZ: co drhne v natáčení - dvě věci v jednom studiu, herec nebo zvukař
 *    na dvou místech naráz. JEN TAM, KDE JE ČLOVĚK OZNAČENÝ (upřesnění
 *    23. 9. 2026: „mě nezajímají konflikty v natáčení. Jen tam, kde jsem
 *    označený") - jako zvukař nebo herec u jedné z těch dvou událostí. Cizí
 *    kolize v cizím studiu je šum, ne informace.
 *
 * JE TO UPOZORNĚNÍ, NE ZÁKAZ. Portál nic nezakazuje ani nepřepisuje - jen
 * řekne, že se dvě věci perou, a ukáže které. Zápis přes kolizi jde dál
 * (tlačítko „Uložit i tak" v kalendáři).
 */

const PASMO = 'Europe/Prague';

export type DruhKonfliktu = 'MOJE' | 'PROVOZ';

export type Konflikt = {
  id: string;
  /**
   * KLÍČ PRO SKRYTÍ (zadání 24. 9. 2026: „měl bych mít možnost někdy zrušit
   * daný konflikt v kalendáři, někdy to může být záměr").
   *
   * Je v něm i čas překryvu, takže jakmile se některá z událostí posune,
   * klíč se změní a upozornění se vrátí - schvaluje se konkrétní překryv.
   */
  klic: string;
  druh: DruhKonfliktu;
  /** Den v Praze, YYYY-MM-DD - klik na konflikt na něj skočí. */
  den: string;
  /** „10:00–11:30" - průnik obou událostí. */
  cas: string;
  /** Čím to drhne: „Studio Brno I je obsazené dvakrát". */
  duvod: string;
  udalosti: { cas: string; popis: string }[];
};

type Polozka = {
  klic: string;
  start: Date;
  end: Date;
  popis: string;
  /**
   * ZABÍRÁ MÍSTO VE STUDIU? (upřesnění 23. 9. 2026: „můžou být dva střihy
   * v každém studiu. Buď je v jednom studiu jedno natáčení a jeden střih,
   * nebo dva střihy. Nemůžou být jen dvě natáčení ve stejný čas v jednom
   * studiu.")
   *
   * Střih běží u stolu, ne v kabině - dva střihy vedle sebe jsou normální
   * provoz. Konflikt studia je tedy jen tam, kde se potkají DVĚ VĚCI, které
   * potřebují kabinu: natáčení, casting nebo blokace studia.
   */
  obsazujeStudio: boolean;
  studioId: string | null;
  studioName: string | null;
  herecId: string | null;
  herecJmeno: string | null;
  zvukarId: string | null;
  zvukarJmeno: string | null;
};

const cas = (d: Date) => minutesToTime(minutesInZone(d, PASMO));
const denVPraze = (d: Date) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: PASMO, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);

/** Překrývají se? Dotek koncem a začátkem (10:00 konec, 10:00 začátek) konflikt není. */
const koliduje = (a: { start: Date; end: Date }, b: { start: Date; end: Date }) =>
  a.start < b.end && b.start < a.end;

const prunik = (a: Polozka, b: Polozka) => {
  const od = new Date(Math.max(a.start.getTime(), b.start.getTime()));
  const doKdy = new Date(Math.min(a.end.getTime(), b.end.getTime()));
  return { od, doKdy, popis: `${cas(od)}–${cas(doKdy)}` };
};

/**
 * Provozní konflikty v rozsahu. Čte celý kalendář, ne jen svoje - proto se
 * ptá na právo na kalendář a nic dalšího nefiltruje.
 */
async function provozniKonflikty(
  od: Date,
  doKdy: Date,
  kdo: { userId: string; jmeno: string | null },
): Promise<Konflikt[]> {
  const [sloty, bloky] = await Promise.all([
    prisma.recordingSlot
      .findMany({
        where: { state: { in: ['SELECTED', 'CONFIRMED'] as never }, start: { lt: doKdy }, end: { gt: od } },
        include: {
          studio: { select: { id: true, shortName: true } },
          request: { select: { projectName: true, actorName: true, actorUserId: true } },
        },
      })
      .catch(() => []),
    prisma.studioBlock
      .findMany({
        where: { start: { lt: doKdy }, end: { gt: od } },
        include: { studio: { select: { id: true, shortName: true } } },
      })
      .catch(() => []),
  ]);

  /**
   * KDO STŘÍHÁ EXTERNĚ (23. 9. 2026: „výjimka je Matěj Suk, který stříhá
   * externě … ale Matěj se píše pod Prahu"). Jeho práce se do kalendáře píše
   * pod studio, ale v tom studiu nesedí - do obsazenosti se nepočítá vůbec.
   */
  const externiIds = new Set(
    (
      await prisma.user
        .findMany({ where: { strihaExterne: true }, select: { id: true } })
        .catch(() => [])
    ).map((u) => u.id),
  );

  /** Druhy blokace, které opravdu drží kabinu. Střih a volno ne. */
  const OBSAZUJE = ['NATACENI', 'CASTING', 'INTERNAL', 'MAINTENANCE'];

  const polozky: Polozka[] = [
    ...sloty.map((s) => ({
      klic: `slot:${s.id}`,
      start: s.start,
      end: s.end,
      popis: `${s.request.projectName} · ${s.request.actorName} (${s.studio.shortName})`,
      obsazujeStudio: !(s.zvukarUserId && externiIds.has(s.zvukarUserId)),
      studioId: s.studio.id,
      studioName: s.studio.shortName,
      herecId: s.request.actorUserId,
      herecJmeno: s.request.actorName,
      zvukarId: s.zvukarUserId,
      zvukarJmeno: null,
    })),
    ...bloky.map((b) => ({
      klic: `blok:${b.id}`,
      start: b.start,
      end: b.end,
      popis: `${b.title} (${b.studio.shortName})`,
      obsazujeStudio:
        OBSAZUJE.includes(String(b.kind)) && !(b.zvukarUserId && externiIds.has(b.zvukarUserId)),
      studioId: b.studio.id,
      studioName: b.studio.shortName,
      herecId: b.actorUserId,
      herecJmeno: b.actorName,
      zvukarId: b.zvukarUserId,
      zvukarJmeno: b.zvukarName,
    })),
  ];

  const jmena = new Map<string, string>();
  const idLidi = polozky.flatMap((p) => [p.herecId, p.zvukarId]).filter((x): x is string => Boolean(x));
  if (idLidi.length > 0) {
    const lide = await prisma.user
      .findMany({ where: { id: { in: [...new Set(idLidi)] } }, select: { id: true, name: true, email: true } })
      .catch(() => []);
    for (const u of lide) jmena.set(u.id, bezTitulu(u.name) || u.email);
  }
  const jmeno = (id: string | null, zaloha: string | null) => (id ? jmena.get(id) ?? zaloha : zaloha);

  const konflikty: Konflikt[] = [];

  for (let i = 0; i < polozky.length; i += 1) {
    for (let j = i + 1; j < polozky.length; j += 1) {
      const a = polozky[i];
      const b = polozky[j];
      if (!koliduje(a, b)) continue;

      const duvody: string[] = [];
      if (a.studioId && a.studioId === b.studioId && a.obsazujeStudio && b.obsazujeStudio) {
        duvody.push(`Studio ${a.studioName} je obsazené dvakrát`);
      }
      const herecA = jmeno(a.herecId, a.herecJmeno);
      const herecB = jmeno(b.herecId, b.herecJmeno);
      if (herecA && herecB && (a.herecId ? a.herecId === b.herecId : herecA === herecB)) {
        duvody.push(`${herecA} je ve dvou natáčeních naráz`);
      }
      const zvukarA = jmeno(a.zvukarId, a.zvukarJmeno);
      const zvukarB = jmeno(b.zvukarId, b.zvukarJmeno);
      if (zvukarA && zvukarB && (a.zvukarId ? a.zvukarId === b.zvukarId : zvukarA === zvukarB)) {
        // Tohle platí i pro externistu: dvě věci naráz nestihne ani on.
        duvody.push(`Zvukař ${zvukarA} je na dvou místech naráz`);
      }
      if (duvody.length === 0) continue;

      /**
       * JEN MOJE NATÁČENÍ (23. 9. 2026). Konflikt se ukáže tomu, kdo je
       * u jedné z těch dvou událostí napsaný - zvukař nebo herec. Kdo u toho
       * není, tomu je to jedno a v seznamu by to jen překáželo.
       */
      const mojeUdalost = (p: Polozka) =>
        p.herecId === kdo.userId ||
        p.zvukarId === kdo.userId ||
        (kdo.jmeno !== null && (p.herecJmeno === kdo.jmeno || p.zvukarJmeno === kdo.jmeno));
      if (!mojeUdalost(a) && !mojeUdalost(b)) continue;

      const p = prunik(a, b);
      const id = `${a.klic}|${b.klic}`;
      konflikty.push({
        id,
        klic: `${id}@${denVPraze(p.od)} ${p.popis}`,
        druh: 'PROVOZ',
        den: denVPraze(p.od),
        cas: p.popis,
        duvod: duvody.join(' · '),
        udalosti: [
          { cas: `${cas(a.start)}–${cas(a.end)}`, popis: a.popis },
          { cas: `${cas(b.start)}–${cas(b.end)}`, popis: b.popis },
        ],
      });
    }
  }

  return konflikty;
}

/** Co se překrývá mně - moje natáčení, střihy, castingy, porady i schůzky. */
async function mojeKonflikty(userId: string, od: Date, doKdy: Date): Promise<Konflikt[]> {
  const udalosti = await udalostiCloveka(userId, od, doKdy).catch(() => []);
  const konflikty: Konflikt[] = [];

  for (let i = 0; i < udalosti.length; i += 1) {
    for (let j = i + 1; j < udalosti.length; j += 1) {
      const a = udalosti[i];
      const b = udalosti[j];
      if (!koliduje(a, b)) continue;

      const zacatek = new Date(Math.max(a.start.getTime(), b.start.getTime()));
      const konec = new Date(Math.min(a.end.getTime(), b.end.getTime()));
      const id = `moje:${a.klic}|${b.klic}`;
      const kdy = `${cas(zacatek)}–${cas(konec)}`;
      konflikty.push({
        id,
        klic: `${id}@${denVPraze(zacatek)} ${kdy}`,
        druh: 'MOJE',
        den: denVPraze(zacatek),
        cas: kdy,
        duvod: 'Máte dvě věci naráz',
        udalosti: [
          { cas: a.cas, popis: a.studio ? `${a.nazev} (${a.studio})` : a.nazev },
          { cas: b.cas, popis: b.studio ? `${b.nazev} (${b.studio})` : b.nazev },
        ],
      });
    }
  }

  return konflikty;
}

export type SkrytyKonflikt = {
  klic: string;
  druh: string;
  popis: string;
  kdo: string;
  kdy: string;
};

export type Konflikty = { moje: Konflikt[]; provoz: Konflikt[]; skryte: SkrytyKonflikt[] };

/**
 * ZÁMĚRNÉ KONFLIKTY (zadání 24. 9. 2026). Klíče toho, co si někdo odklepl -
 * viz model SkrytyKonflikt.
 *
 * Skrývá se pro všechny, ne jen pro toho, kdo klikl: konflikt „moje" stejně
 * vidí jen jeden člověk a u provozních platí, že když je překryv schválený,
 * je schválený i pro druhého označeného.
 */
async function skryteKonflikty(): Promise<Map<string, SkrytyKonflikt>> {
  try {
    const radky = await prisma.skrytyKonflikt.findMany({ orderBy: { createdAt: 'desc' } });
    return new Map(
      radky.map((r) => [
        r.klic,
        {
          klic: r.klic,
          druh: r.druh,
          popis: r.popis,
          kdo: r.kdoJmeno,
          kdy: r.createdAt.toISOString(),
        },
      ]),
    );
  } catch (err) {
    console.error('Cteni skrytych konfliktu selhalo:', err);
    return new Map();
  }
}

/** Odklepnout konflikt jako záměr. */
export async function skryjKonflikt(
  k: { klic: string; druh: string; popis: string; duvod?: string | null },
  kdo: { id: string | null; jmeno: string },
): Promise<void> {
  await prisma.skrytyKonflikt.upsert({
    where: { klic: k.klic },
    create: {
      klic: k.klic,
      druh: k.druh,
      popis: k.popis.slice(0, 300),
      duvod: k.duvod?.slice(0, 300) ?? null,
      kdoId: kdo.id,
      kdoJmeno: kdo.jmeno.slice(0, 120),
    },
    update: { kdoId: kdo.id, kdoJmeno: kdo.jmeno.slice(0, 120) },
  });
}

/** Vrátit upozornění zpátky. */
export async function vratKonflikt(klic: string): Promise<void> {
  await prisma.skrytyKonflikt.deleteMany({ where: { klic } });
}

/**
 * Konflikty v rozsahu. `moje` dostane jen ten, koho se týkají (jsou jeho),
 * `provoz` každý, kdo smí na kalendář.
 */
export async function najdiKonflikty(
  userId: string,
  role: Role | string,
  od: Date,
  doKdy: Date,
): Promise<Konflikty> {
  const ja = await prisma.user
    .findUnique({ where: { id: userId }, select: { name: true, email: true } })
    .catch(() => null);
  const jmeno = ja ? bezTitulu(ja.name) || ja.email : null;

  const [moje, provoz] = await Promise.all([
    mojeKonflikty(userId, od, doKdy),
    canViewCalendar(role as Role)
      ? provozniKonflikty(od, doKdy, { userId, jmeno })
      : Promise.resolve([]),
  ]);

  // Co si někdo odklepl jako záměr, se do seznamu nevrací - jen se ukáže dole
  // v panelu, aby se to dalo vrátit (24. 9. 2026).
  const skryte = await skryteKonflikty();
  const vlastniKlice = new Set(moje.map((k) => k.klic));
  const viditelne = (k: Konflikt) => !skryte.has(k.klic);
  // Cizí „moje" konflikt nikomu nic neříká - v seznamu skrytých je jen to,
  // co by ten člověk jinak viděl.
  const vidimSkryty = (s: SkrytyKonflikt) => s.druh === 'PROVOZ' || vlastniKlice.has(s.klic);

  const podleCasu = (a: Konflikt, b: Konflikt) => (a.den + a.cas).localeCompare(b.den + b.cas);
  return {
    moje: moje.filter(viditelne).sort(podleCasu),
    provoz: provoz.filter(viditelne).sort(podleCasu),
    skryte: [...skryte.values()].filter(vidimSkryty),
  };
}

/**
 * Kolik konfliktů člověka čeká - číslo na odznak u Kalendáře v liště.
 * Dívá se od teď dopředu, ne do minulosti: co bylo, se už nepřeloží.
 *
 * Čtrnáct dní schválně: odznak počítá layout při každém otevření stránky, tak
 * ať to není pokaždé měsíc kalendáře. Delší dohled ukáže štítek v kalendáři,
 * který počítá zobrazený rozsah.
 */
export async function pocetKonfliktu(
  userId: string,
  role: Role | string,
  dnu = DNU_KONFLIKTU,
): Promise<number> {
  try {
    const ted = new Date();
    const doKdy = new Date(ted.getTime() + dnu * 24 * 3600_000);
    const k = await najdiKonflikty(userId, role, ted, doKdy);
    return k.moje.length + k.provoz.length;
  } catch (err) {
    console.error('Pocet konfliktu selhal:', err);
    return 0;
  }
}
