import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { listAllCaflouProjectsForInternal } from '@/lib/caflou';
import { DEFAULT_HOURLY_RATE } from '@/lib/timesheets';
import { TimesheetEditor } from './TimesheetEditor';

// Výkazy zvukařů (zadani 6. 9. 2026). Vidi je zvukar (svoje) a Zuzo-labuzo
// (vsechny) - produkce ani klienti se sem nedostanou.
export const dynamic = 'force-dynamic';

export default async function TimesheetsPage() {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;
  if (!session?.user?.id || (role !== 'ZVUKAR' && role !== 'ADMIN')) redirect('/projekty');

  const isAdmin = role === 'ADMIN';

  const [me, entries, companies] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.user.id }, select: { hourlyRate: true } }),
    prisma.timesheetEntry.findMany({
      where: isAdmin ? {} : { userId: session.user.id },
      orderBy: [{ date: 'desc' }, { startMinutes: 'desc' }],
      take: 300,
      include: { user: { select: { id: true, name: true, email: true } } },
    }),
    prisma.company.findMany({
      where: { caflouCompanyId: { not: null } },
      select: { name: true, caflouCompanyId: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  // Nabidka projektu pro vyber - z Caflou, stejny (cachovany) seznam jako
  // pouziva prehled Projekty, takze to nic navic nestoji.
  const { projects } = await listAllCaflouProjectsForInternal(
    companies.map((c) => ({ name: c.name, caflouCompanyId: c.caflouCompanyId! })),
  );
  const projectOptions = projects
    .filter((p) => !p.finished)
    .map((p) => ({ id: String(p.id), label: p.companyName ? `${p.name} — ${p.companyName}` : p.name }))
    .sort((a, b) => a.label.localeCompare(b.label, 'cs'));

  return (
    <TimesheetEditor
      isAdmin={isAdmin}
      hourlyRate={me?.hourlyRate ?? DEFAULT_HOURLY_RATE}
      projectOptions={projectOptions}
      entries={entries.map((e) => ({
        id: e.id,
        date: e.date.toISOString().slice(0, 10),
        startMinutes: e.startMinutes,
        endMinutes: e.endMinutes,
        workType: e.workType,
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
