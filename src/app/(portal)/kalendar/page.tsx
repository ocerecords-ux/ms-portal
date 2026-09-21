import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canManageCalendar, canViewCalendar } from '@/lib/roles';
import { loadOccupancy, loadStudios, releaseExpiredHolds } from '@/lib/calendarServer';
import { loadInternalProjects } from '@/lib/projektySeznamServer';
import {
  BLOCK_KIND_LABELS,
  addDays,
  startOfMonth,
  startOfWeek,
  utcParts,
  zonedToUtc,
  ZADNE_STUDIO,
  SOLO_MIMO,
  type CalendarView,
} from '@/lib/calendar';
import { CalendarBrowser, type CalendarEvent, type CalendarDay } from './CalendarBrowser';
import { bezTitulu } from '@/lib/jmena';
import { INTERNAL_ROLES } from '@/lib/roles';
import type { NepritomnostVKalendari } from '@/lib/nepritomnost';
import { SOLO_PORADY } from '@/lib/porady';
import { nactiPorady } from '@/lib/poradyServer';

/**
 * Kalendář studií (zadani 8. 9. 2026, upraveno 9. 9. 2026). Den / týden /
 * měsíc, a nově se dají studia PROLNOUT — každé má svou barvu a jde
 * zaškrtnout, která jsou vidět.
 *
 * Vidí ho tým Mediaspace: Produkce a Žůžo-labůžo i zapisují, zvukař jen čte.
 * Herec má vlastní, užší pohled (/moje-terminy) — sem nesmí.
 */
export const dynamic = 'force-dynamic';

function parseView(value?: string): CalendarView {
  return value === 'den' || value === 'mesic' ? value : 'tyden';
}

function parseDate(value?: string): Date {
  if (value) {
    const d = new Date(`${value}T12:00:00.000Z`);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

export default async function KalendarPage({
  searchParams,
}: {
  searchParams: {
    studia?: string;
    studio?: string;
    pohled?: string;
    datum?: string;
    /** „0" = kalendář Mimo studio je vypnutý (zadání 19. 9. 2026). */
    nepritomnost?: string;
    /**
     * Prozatímní sólo jednoho kalendáře (zadání 20. 9. 2026): id studia nebo
     * „mimo". `studia` a `nepritomnost` zůstávají netknuté, takže odebráním
     * `solo` se vrátí zaškrtnutí, jaké bylo před kliknutím.
     */
    solo?: string;
    /** „0" = kalendář Porady je vypnutý (zadání 21. 9. 2026). */
    porady?: string;
  };
}) {
  const session = await getServerSession(authOptions);
  if (!session || !canViewCalendar(session.user.role)) redirect('/projekty');

  // Termíny, které herec vybral a produkce je včas nepotvrdila, se vrací do
  // nabídky. Vercel nemá nic, co by běželo samo, tak se to dělá tady.
  //
  // Úklid a načtení studií spolu nesouvisí, takže běží najednou (zpráva
  // 9. 9. 2026 o zpomaleném webu). Dřív se čekalo nejdřív na úklid a teprve
  // pak na studia - dvě kolečka do databáze za sebou tam, kde stačí jedno.
  const [, studios] = await Promise.all([releaseExpiredHolds(), loadStudios()]);
  if (studios.length === 0) {
    return (
      <section className="flex flex-col gap-4">
        <h1 className="font-display text-3xl sm:text-4xl text-ink m-0">Kalendář</h1>
        <p className="text-sm font-body text-muted m-0">
          Zatím tu není žádné studio. Studia se zakládají v administraci.
        </p>
      </section>
    );
  }

  // Vybraná studia: seznam v adrese, jinak všechna. `studio` je stará podoba
  // odkazu s jedním studiem - ať fungují uložené odkazy dál.
  const parametrStudii = (searchParams?.studia ?? searchParams?.studio ?? '').trim();
  const zAdresy = parametrStudii
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
  const vybrana = studios.filter((s) => zAdresy.includes(s.id));
  // Značka „zadne" = všechna studia zhasnutá, v kalendáři zbyl jen Mimo
  // studio (klik na jeho název, 20. 9. 2026). Prázdný parametr dál znamená
  // „všechna studia", aby zkrácené odkazy fungovaly jako dřív.
  const puvodni = parametrStudii === ZADNE_STUDIO ? [] : vybrana.length > 0 ? vybrana : studios;
  const puvodniNepritomnost = searchParams?.nepritomnost !== '0';

  // SÓLO (20. 9. 2026) - dočasně svítí jen jeden kalendář, původní výběr
  // zůstává v adrese a vrátí se, jakmile sólo zmizí.
  const soloZAdresy = (searchParams?.solo ?? '').trim();
  const soloStudio = studios.find((s) => s.id === soloZAdresy) ?? null;
  const soloMimo = soloZAdresy === SOLO_MIMO;
  const soloPorady = soloZAdresy === SOLO_PORADY;
  const solo = soloStudio ? soloStudio.id : soloMimo ? SOLO_MIMO : soloPorady ? SOLO_PORADY : '';
  const puvodniPorady = searchParams?.porady !== '0';

  const aktivni = solo ? (soloStudio ? [soloStudio] : []) : puvodni;
  // Mřížka (pásmo a otevírací doba) se musí o něco opřít i bez studií.
  const mrizkaPodle = aktivni[0] ?? puvodni[0] ?? studios[0];

  const view = parseView(searchParams?.pohled);
  const anchor = parseDate(searchParams?.datum);
  // Mřížka se kreslí v pásmu prvního vybraného studia; u víc studií naráz se
  // musí zvolit jedno, jinak by sloupce nesouhlasily.
  const tz = mrizkaPodle.timezone;

  const anchorParts = utcParts(anchor, tz);
  const anchorLocal = new Date(anchorParts.year, anchorParts.month - 1, anchorParts.day);

  /**
   * JEDEN DLOUHÝ PÁS (zadání 20. 9. 2026: „chci to posouvat, jako by to byl
   * jeden dlouhý pás").
   *
   * Kalendář se neposouvá po stránkách - vedle sebe leží TŘI období
   * (předchozí, zobrazené, následující) a rolují se jako jeden pruh. Proto se
   * ze serveru posílají všechna tři: kdyby se soused načítal až po švihnutí,
   * pás by měl na kraji díru.
   */
  function dnyObdobi(prvni: Date, pocet: number, mesicPodle: Date): CalendarDay[] {
    const vysledek: CalendarDay[] = [];
    for (let i = 0; i < pocet; i++) {
      const d = addDays(prvni, i);
      const start = zonedToUtc(d.getFullYear(), d.getMonth() + 1, d.getDate(), 0, tz);
      const end = zonedToUtc(d.getFullYear(), d.getMonth() + 1, d.getDate() + 1, 0, tz);
      const weekday = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getDay();
      // Pracovní doba se bere z prvního studia - u prolnutých kalendářů je to
      // jen vodítko, ne zákaz.
      const pravidlo = mrizkaPodle.hours.find((h) => h.weekday === weekday);
      vysledek.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
        startIso: start.toISOString(),
        endIso: end.toISOString(),
        // „Patří do měsíce" se u každého pásu měří k JEHO měsíci, ne
        // k zobrazenému - jinak by sousední měsíc byl celý zašedlý.
        inMonth: d.getMonth() === mesicPodle.getMonth() && d.getFullYear() === mesicPodle.getFullYear(),
        byArrangement: pravidlo?.byArrangement ?? false,
        openFrom: pravidlo?.startMinutes ?? null,
        openTo: pravidlo?.endMinutes ?? null,
      });
    }
    return vysledek;
  }

  /** Začátek období, které je o `posun` dál (-1 dozadu, +1 dopředu). */
  function obdobi(posun: number): { prvni: Date; pocet: number; mesic: Date } {
    if (view === 'den') {
      const d = addDays(anchorLocal, posun);
      return { prvni: d, pocet: 1, mesic: d };
    }
    if (view === 'tyden') {
      const d = addDays(startOfWeek(anchorLocal), 7 * posun);
      return { prvni: d, pocet: 7, mesic: d };
    }
    const m = new Date(anchorLocal.getFullYear(), anchorLocal.getMonth() + posun, 1);
    // šest týdnů, ať měsíc vždycky vyjde celý
    return { prvni: startOfWeek(startOfMonth(m)), pocet: 42, mesic: m };
  }

  const panely = [-1, 0, 1].map((posun) => {
    const o = obdobi(posun);
    const dny = dnyObdobi(o.prvni, o.pocet, o.mesic);
    return { klic: dny[0].key, days: dny };
  });
  const days = panely[1].days;

  // Rozsah dat pokrývá celý pás, ne jen prostřední období.
  const from = new Date(panely[0].days[0].startIso);
  const to = new Date(panely[2].days[panely[2].days.length - 1].endIso);

  // NABÍDNUTÁ MÍSTA SE V KALENDÁŘI NEUKAZUJÍ (19. 9. 2026: „nejdou mi upravit
  // ani smazat"). Od chvíle, kdy se nabídka skládá sama ze VŠECH volných míst,
  // by kalendář zaplnily desítky bloků „Nabídnuto" - nejsou to rezervace,
  // studio nezabírají a upravit ani smazat nejdou (obnova nabídky by je
  // vrátila). V kalendáři je jen to, co opravdu platí: termín, který si herec
  // vybral (drženo), a potvrzená frekvence - ty jdou dvojklikem upravit.
  const occupancy = await loadOccupancy(aktivni.map((s) => s.id), from, to);

  /**
   * Nabídka do ručně zapsané události (zadání 14. 9. 2026) - projekt, herec
   * a zvukař. Načítá se jen tomu, kdo do kalendáře smí psát; zvukař ho jen
   * čte, takže by tahal seznamy, se kterými nic neudělá.
   */
  const muzeZapisovat = canManageCalendar(session.user.role);
  const [projektyProUdalost, lideProUdalost] = muzeZapisovat
    ? await Promise.all([
        loadInternalProjects()
          .then(({ projects }) =>
            projects
              .map((p) => ({
                id: String(p.id),
                // V nabídce firma zůstává (odliší dva stejné názvy), do popisku
                // události jde jen `nazev` - viz popisUdalosti.
                label: p.companyName ? `${p.name} — ${p.companyName}` : p.name,
                nazev: p.name,
                dokonceny: p.finished,
              }))
              .sort((a, b) => a.label.localeCompare(b.label, 'cs')),
          )
          .catch(() => []),
        prisma.user
          .findMany({
            where: { active: true, role: { in: ['HEREC', 'ZVUKAR'] } },
            // Studia zvukare (zadani 20. 9. 2026) - podle nich se v nabidce
            // radi nejdriv ti, kteri v tom studiu toci.
            select: { id: true, name: true, email: true, role: true, zvukarStudia: { select: { id: true } } },
            orderBy: [{ name: 'asc' }],
          })
          .catch(() => []),
      ])
    : [[], []];

  // Tituly pred a za jmenem se u hercu nevypisuji (zadani 15. 9. 2026).
  const herci = lideProUdalost
    .filter((u) => u.role === 'HEREC')
    .map((u) => ({ id: u.id, label: bezTitulu(u.name) || u.email }));
  const zvukari = lideProUdalost
    .filter((u) => u.role === 'ZVUKAR')
    .map((u) => ({ id: u.id, label: u.name || u.email, studia: u.zvukarStudia.map((s) => s.id) }));

  /**
   * KALENDÁŘ MIMO STUDIO (zadání 19. 9. 2026). Vlastní kalendář vedle
   * studií - dá se zapnout a vypnout stejně jako studio, ve výchozím stavu
   * je vidět: při plánování natáčení je to přesně to, co člověk potřebuje
   * vědět, kdo zrovna není.
   *
   * Načítá se všechno, co do zobrazeného rozsahu aspoň zasahuje - i dovolená,
   * která začala minulý týden a končí ve středu.
   */
  const ukazNepritomnost = solo ? soloMimo : puvodniNepritomnost;
  // PORADY (21. 9. 2026) - jen ty, na které je přihlášený pozvaný.
  const ukazPorady = solo ? soloPorady : puvodniPorady;
  const porady = ukazPorady ? await nactiPorady(session.user.id, from, to) : [];
  const spravceKalendare = canManageCalendar(session.user.role);
  const [radkyNepritomnosti, lidiTymu] = await Promise.all([
    ukazNepritomnost
      ? prisma.nepritomnost
          .findMany({
            where: { start: { lt: to }, end: { gt: from } },
            orderBy: [{ start: 'asc' }, { jmeno: 'asc' }],
          })
          .catch(() => [])
      : Promise.resolve([]),
    // Z koho se v okně Mimo studio vybírá - pro všechny (19. 9. 2026).
    prisma.user
      .findMany({
        where: { active: true, role: { in: INTERNAL_ROLES } },
        select: { id: true, name: true, email: true },
        orderBy: [{ name: 'asc' }],
      })
      .catch(() => []),
  ]);
  const nepritomnosti: NepritomnostVKalendari[] = radkyNepritomnosti.map((n) => ({
    id: n.id,
    userId: n.userId,
    jmeno: n.jmeno,
    druh: n.druh,
    celyDen: n.celyDen,
    start: n.start.toISOString(),
    end: n.end.toISOString(),
    poznamka: n.poznamka,
    muzeUpravit:
      spravceKalendare || n.userId === session.user.id || n.zapsalId === session.user.id,
  }));

  const barvaStudia = new Map(studios.map((s) => [s.id, s.color]));
  const nazevStudia = new Map(studios.map((s) => [s.id, s.shortName]));

  const events: CalendarEvent[] = [
    ...occupancy.slots.map((s) => ({
      id: s.id,
      kind: 'SLOT' as const,
      studioId: s.studioId,
      studioName: nazevStudia.get(s.studioId) ?? '',
      color: barvaStudia.get(s.studioId) ?? '#7B55FF',
      start: s.start.toISOString(),
      end: s.end.toISOString(),
      state: s.state,
      // Zvukar primo v nadpisu, stejne jako u rucne zapsane udalosti.
      title: s.zvukarName ? `${s.label}\nZVUKAŘ: ${s.zvukarName}` : s.label,
      href: `/kalendar/nabidka/${s.requestId}`,
      poznamka: s.note,
      udalost: {
        caflouProjectId: s.caflouProjectId,
        projectName: s.projectName,
        actorUserId: s.actorUserId,
        actorName: s.actorName,
        zvukarUserId: s.zvukarUserId,
        zvukarName: s.zvukarName,
      },
    })),
    ...occupancy.blocks.map((b) => ({
      id: b.id,
      kind: 'BLOCK' as const,
      studioId: b.studioId,
      studioName: nazevStudia.get(b.studioId) ?? '',
      color: barvaStudia.get(b.studioId) ?? '#7B55FF',
      start: b.start.toISOString(),
      end: b.end.toISOString(),
      state: b.kind,
      // Zvukar i herec primo v bubline, stejne jako u frekvence z nabidky
      // (20. 9. 2026: „nejsou tam nikde videt zvukari").
      // Popis převzatých událostí už řádek se zvukařem obsahuje (skládá ho
      // popisUdalosti), takže se nesmí přidat podruhé (20. 9. 2026).
      title: [
        b.actorName && !b.title.includes(b.actorName) ? `${b.title} – ${b.actorName}` : b.title,
        b.zvukarName && !b.title.includes('ZVUKAŘ:') ? `ZVUKAŘ: ${b.zvukarName}` : null,
      ]
        .filter(Boolean)
        .join('\n'),
      subtitle: BLOCK_KIND_LABELS[b.kind] ?? 'Blokace',
      poznamka: b.note,
      // Rozepsané údaje pro úpravu události (zadání 14. 9. 2026).
      udalost: {
        caflouProjectId: b.caflouProjectId,
        projectName: b.projectName,
        actorUserId: b.actorUserId,
        actorName: b.actorName,
        zvukarUserId: b.zvukarUserId,
        zvukarName: b.zvukarName,
      },
    })),
  ];

  return (
    <CalendarBrowser
      studios={studios.map((s) => ({
        id: s.id,
        shortName: s.shortName,
        name: s.name,
        timezone: s.timezone,
        color: s.color,
      }))}
      selectedStudioIds={aktivni.map((s) => s.id)}
      puvodniStudioIds={puvodni.map((s) => s.id)}
      puvodniNepritomnost={puvodniNepritomnost}
      solo={solo}
      timezone={tz}
      view={view}
      anchorIso={anchorLocal.toISOString().slice(0, 10)}
      days={days}
      panely={panely}
      events={events}
      canManage={muzeZapisovat}
      projekty={projektyProUdalost}
      herci={herci}
      zvukari={zvukari}
      nepritomnosti={nepritomnosti}
      ukazNepritomnost={ukazNepritomnost}
      porady={porady}
      ukazPorady={ukazPorady}
      puvodniPorady={puvodniPorady}
      ja={{ id: session.user.id, label: session.user.name || session.user.email }}
      lidiTymu={lidiTymu.map((u) => ({ id: u.id, label: u.name || u.email }))}
    />
  );
}
