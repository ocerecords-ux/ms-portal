import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isInternalRole } from '@/lib/roles';
import { nactiVzorPrezentace } from '@/lib/prezentaceVzor';
import { nactiJazyk } from '@/lib/jazykServer';
import { prelozit } from '@/lib/jazyk';
import { VzorPrezentaceEditor } from './VzorPrezentaceEditor';

/**
 * VZOR TEXTŮ NABÍDKOVÉ PREZENTACE (zadání 11. 10. 2026).
 *
 * Podmínky spolupráce - licence, termíny dodání, platba - jsou u všech
 * nabídek skoro stejné. Kdyby se psaly pokaždé znovu, po půl roce by každá
 * nabídka slibovala něco jiného. Tady se napíšou jednou a každá nová
 * prezentace je dostane předvyplněné; u projektu se pak doladí.
 *
 * JEN PŘEDVYPLNĚNÍ. Změna vzoru NEPŘEPÍŠE prezentace, které už vznikly -
 * co klient jednou dostal, musí zůstat, jak to bylo.
 */
export const dynamic = 'force-dynamic';

export default async function VzorPrezentacePage() {
  const jazyk = nactiJazyk();
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !isInternalRole(session.user.role)) redirect('/projekty');

  const vzor = await nactiVzorPrezentace();

  return (
    <div className="flex flex-col gap-6">
      <Link href="/admin" className="text-muted text-sm font-heading no-underline">
        ← {prelozit(jazyk, 'obecne.zpetAdministrace')}
      </Link>
      <div>
        <h1 className="font-display text-3xl sm:text-4xl text-ink m-0">{prelozit(jazyk, 'vzorPrezentace.nadpis')}</h1>
        <p className="text-sm font-body text-muted m-0 mt-2 max-w-[70ch]">
          {prelozit(jazyk, 'vzorPrezentace.uvod')}
        </p>
      </div>
      <VzorPrezentaceEditor
        navrhReseni={vzor?.navrhReseni ?? ''}
        podminky={vzor?.podminky ?? ''}
      />
    </div>
  );
}
