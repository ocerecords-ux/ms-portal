import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { loadInternalProjects } from '@/lib/projektySeznamServer';
import { DEFAULT_HOURLY_RATE } from '@/lib/timesheets';
import { TimesheetEditor } from './TimesheetEditor';

// Výkazy zvukařů (zadani 6. 9. 2026). Vidi je zvukar (VYHRADNE svoje) a
// Zuzo-labuzo (vsechny, jen ke cteni - vykazy si nedela) - produkce ani
// klienti se sem nedostanou.
export const dynamic = 'force-dynamic';

export default async function TimesheetsPage() {
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

  return (
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
  );
}
