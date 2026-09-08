import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { ROLE_LABELS, isInternalRole } from '@/lib/roles';
import { MyAccountForm } from './MyAccountForm';
import { TaskWidget } from './TaskWidget';

// "Můj účet" - kazdy prihlaseny uzivatel si tu upravi svoje udaje (zadani
// 5. 9. 2026). Role, kod uctu a firma jsou tu jen k precteni; menit je smi
// vyhradne administrace.
//
// Clenove tymu Mediaspace maji navic vpravo widget s ukoly (zadani 5. 9. 2026).
export const dynamic = 'force-dynamic';

export default async function MyAccountPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/login');

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { company: { select: { name: true } } },
  });
  if (!user) redirect('/login');

  const internal = isInternalRole(user.role);

  // Ukoly nacitame jen internimu tymu - klientum se widget nezobrazuje.
  const tasks = internal
    ? await prisma.task.findMany({
        where: { userId: user.id },
        orderBy: [{ done: 'asc' }, { dueDate: 'asc' }, { sortOrder: 'asc' }],
        take: 200,
      })
    : [];

  return (
    <div className={internal ? 'grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)] gap-8' : ''}>
      <section className="flex flex-col gap-6 max-w-2xl">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl text-ink m-0">Můj účet</h1>
          <p className="text-muted text-sm mt-1 font-body">
            Tady si spravujete svoje kontaktní údaje. Typ přístupu, kód účtu ani firmu měnit nelze — s tím se obraťte
            na Mediaspace.
          </p>
        </div>

        <div className="bg-white rounded-card border border-line shadow-sm p-5">
          <dl className="grid grid-cols-1 sm:grid-cols-3 gap-x-8 gap-y-4 m-0">
            <div>
              <dt className="text-xs font-heading text-muted uppercase tracking-wide">Kód účtu</dt>
              <dd className="text-sm font-heading text-ink m-0 mt-1 tabular-nums">{user.code || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs font-heading text-muted uppercase tracking-wide">Typ přístupu</dt>
              <dd className="text-sm font-heading text-ink m-0 mt-1">{ROLE_LABELS[user.role]}</dd>
            </div>
            {/* Firma se ukazuje jen u klientu - interni ucty Mediaspace ani herci
                pod zadnou firmu nepatri (zadani 5. 9. 2026), takze by tu bylo
                natvrdo jen prazdne pole. */}
            {user.company && (
              <div>
                <dt className="text-xs font-heading text-muted uppercase tracking-wide">Firma</dt>
                <dd className="text-sm font-heading text-ink m-0 mt-1">{user.company.name}</dd>
              </div>
            )}
          </dl>
        </div>

        <MyAccountForm
          internal={internal}
          initial={{
            name: user.name ?? '',
            email: user.email,
            phone: user.phone ?? '',
            birthDate: user.birthDate ? user.birthDate.toISOString().slice(0, 10) : '',
          }}
        />
      </section>

      {internal && (
        <TaskWidget
          tasks={tasks.map((t) => ({
            id: t.id,
            title: t.title,
            done: t.done,
            dueDate: t.dueDate ? t.dueDate.toISOString().slice(0, 10) : null,
          }))}
        />
      )}
    </div>
  );
}
