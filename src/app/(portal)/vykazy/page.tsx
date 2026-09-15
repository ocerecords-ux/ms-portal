import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { loadInternalProjects } from '@/lib/projektySeznamServer';
import { DEFAULT_HOURLY_RATE } from '@/lib/timesheets';
import { TimesheetEditor } from './TimesheetEditor';
import { BonusyPanel, type Bonus } from './BonusyPanel';

// Výkazy zvukařů (zadani 6. 9. 2026). Vidi je zvukar (VYHRADNE svoje) a
// Zuzo-labuzo (vsechny, jen ke cteni - vykazy si nedela) - produkce ani
// klienti se sem nedostanou.
export const dynamic = 'force-dynamic';

export default async function TimesheetsPage({
  searchParams,
}: {
  searchParams?: { zalozka?: string };
}) {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;
  if (!session?.user?.id || (role !== 'ZVUKAR' && role !== 'ADMIN')) redirect('/projekty');

  const isAdmin = role === 'ADMIN';
  // Vykaz si pise jen zvukar (zadani 6. 9. 2026: "Nikdo ze Žůžo Labůžo si
  // výkazy nedělá") - Zuzo-labuzo ma tuhle stranku jen jako prehled.
  //
  // UPRAVOVAT uz ale smi oba (zadani 14. 9. 2026: "A melo by jit upravit
  // vykazy. Prava na to budou mit Zuzo-labuzo i zvukari"). Zalozit novy vykaz
  // Zuzo-labuzo porad nemuze - to by bylo proti zadani z 6. 9.; muze jen
  // opravit ten, co uz nekdo napsal. Stejne jako u mazani, ktere tu ma od
  // zacatku.
  const canWrite = role === 'ZVUKAR';

  const [me, entries] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.user.id }, select: { hourlyRate: true } }),
    prisma.timesheetEntry.findMany({
      // Zvukar nikdy nedostane data kolegu - filtruje se uz v dotazu, ne az
      // v prohlizeci.
      where: isAdmin ? {} : { userId: session.user.id },
      orderBy: [{ date: 'desc' }, { startMinutes: 'desc' }],
      take: 2000,
      include: { user: { select: { id: true, name: true, email: true } } },
    }),
  ]);

  /**
   * Nabidka projektu pro vyber - stejny seznam, jaky pouziva prehled Projekty.
   * Zuzo-labuzo si vykaz nepise, takze pro nej seznam vubec nenacitame.
   *
   * DOKONCENE PROJEKTY V NABIDCE ZUSTAVAJI (zadani 11. 9. 2026: "porad
   * zvukari nevidi ukoncene"). Do 6. 9. 2026 se do nabidky davaly jen
   * rozpracovane - jenze prace na projektu castokrat dobehne az potom, co
   * ho produkce uzavre, a zvukar pak nemel kam vykaz napsat. Jsou proto
   * oznacene a v seznamu az za rozdelanymi, at se na ne neklikne omylem.
   */
  // Seznam se nacita i pro Zuzo-labuzo - potrebuje ho pri UPRAVE ciziho
  // vykazu (14. 9. 2026), kde se projekt da prehodit.
  const projectOptions = canWrite || isAdmin
    ? await (async () => {
        const { projects } = await loadInternalProjects();
        return projects
          .map((p) => ({
            id: String(p.id),
            label: p.companyName ? `${p.name} — ${p.companyName}` : p.name,
            dokonceny: p.finished,
          }))
          .sort((a, b) => a.label.localeCompare(b.label, 'cs'));
      })()
    : [];

  /**
   * BONUSY ZVUKAŘŮ (zadání 15. 9. 2026: „na tyto bonusy bych udělal zvlášť
   * záložku ve výkazech: Bonusy ke schválení").
   *
   * Žůžo-labůžo vidí všechny, zvukař jen svoje - filtruje se v dotazu, ne až
   * v prohlížeči, stejně jako u výkazů samotných.
   */
  const bonusyRaw = await prisma.bonusZvukare
    .findMany({
      where: isAdmin ? {} : { userId: session.user.id },
      orderBy: [{ stav: 'asc' }, { navrzenoAt: 'desc' }],
      take: 300,
      include: { user: { select: { name: true, email: true } } },
    })
    .catch(() => []);

  const bonusy: Bonus[] = bonusyRaw.map((b) => ({
    id: b.id,
    projectId: b.caflouProjectId,
    projectName: b.projectName,
    userLabel: b.user.name || b.user.email,
    castka: b.castka,
    podilProcent: b.podilProcent,
    minutZvukare: b.minutZvukare,
    minutCelkem: b.minutCelkem,
    stav: b.stav,
    navrzenoAt: b.navrzenoAt.toISOString(),
    rozhodnutoAt: b.rozhodnutoAt ? b.rozhodnutoAt.toISOString() : null,
    rozhodlJmeno: b.rozhodlJmeno,
    vlastni: b.userId === session.user.id,
    rucne: b.rucne,
    poznamka: b.poznamka,
  }));

  /**
   * Nabídka pro ruční přidání bonusu (zadání 15. 9. 2026). Zvukaři z portálu;
   * projekty tytéž, jaké se nabízejí u výkazu, takže se hledá lupou a ne
   * v seznamu se stovkami řádků.
   */
  const zvukari = isAdmin
    ? (
        await prisma.user.findMany({
          where: { role: 'ZVUKAR', active: true },
          select: { id: true, name: true, email: true },
          orderBy: { name: 'asc' },
        })
      ).map((u) => ({ id: u.id, label: u.name || u.email }))
    : [];
  const keSchvaleni = bonusy.filter((b) => b.stav === 'NAVRZENO').length;
  const naBonusech = searchParams?.zalozka === 'bonusy';

  // Stejna sazba jako mesicni zalozky uvnitr vykazu - at je na prvni pohled
  // videt, ze je to zalozka, ne tlacitko (zadani 15. 9. 2026).
  const zalozkaClass = (aktivni: boolean) =>
    `px-4 py-2.5 text-sm font-heading font-semibold rounded-t-lg -mb-px border border-b-0 no-underline transition-colors ${
      aktivni ? 'bg-surface border-line text-brand-purple' : 'border-transparent text-muted hover:text-ink'
    }`;

  return (
    <div className="flex flex-col gap-6">
      {/* Zalozky nad celou strankou. Drzi se v adrese, ne ve stavu - odznak
          v liste na ni tak muze rovnou odkazat. */}
      <div className="flex items-center gap-1 flex-wrap border-b border-line">
        <Link href="/vykazy" className={zalozkaClass(!naBonusech)}>
          Výkazy
        </Link>
        <Link href="/vykazy?zalozka=bonusy" className={zalozkaClass(naBonusech)}>
          {isAdmin ? 'Bonusy ke schválení' : 'Moje bonusy'}
          {keSchvaleni > 0 && (
            <span className="ml-2 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-pill bg-danger text-white text-[11px] tabular-nums">
              {keSchvaleni}
            </span>
          )}
        </Link>
      </div>

      {naBonusech ? (
        <BonusyPanel
          bonusy={bonusy}
          muzeSchvalovat={isAdmin}
          projekty={projectOptions.map((p) => ({ id: p.id, label: p.label }))}
          zvukari={zvukari}
        />
      ) : (
    <TimesheetEditor
      isAdmin={isAdmin}
      canWrite={canWrite}
      hourlyRate={me?.hourlyRate ?? DEFAULT_HOURLY_RATE}
      projectOptions={projectOptions}
      entries={entries.map((e) => ({
        id: e.id,
        date: e.date.toISOString().slice(0, 10),
        startMinutes: e.startMinutes,
        endMinutes: e.endMinutes,
        workType: e.workType,
        projectId: e.caflouProjectId,
        projectName: e.projectName,
        note: e.note,
        hourlyRateSnapshot: e.hourlyRateSnapshot,
        userId: e.userId,
        userLabel: e.user.name || e.user.email,
        mine: e.userId === session.user.id,
      }))}
    />
      )}
    </div>
  );
}
