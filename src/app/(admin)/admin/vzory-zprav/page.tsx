import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { nactiVzory } from '@/lib/vzoryZpravServer';
import { VzoryEditor } from './VzoryEditor';

/**
 * Vzory zpráv klientovi (zadání 11. 9. 2026: „uděláme vzory a já si je pak
 * můžu textově ještě třeba upravit, pracoval bych i s proměnnými").
 */
export const dynamic = 'force-dynamic';

export default async function VzoryZpravPage() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'ADMIN') redirect('/projekty');

  return (
    <div className="flex flex-col gap-6">
      <Link href="/admin" className="text-muted text-sm font-heading no-underline">
        ← Zpět do administrace
      </Link>
      <div>
        <h1 className="font-display text-3xl sm:text-4xl text-ink m-0">Vzory zpráv klientovi</h1>
        <p className="text-sm font-body text-muted m-0 mt-2 max-w-[70ch]">
          Co klientovi dorazí, když projekt přejde do daného stavu. Komu to jde a jestli vůbec,
          se nastavuje zvlášť u každé firmy pod záložkou Notifikace — tady se píše jen znění.
        </p>
      </div>
      <VzoryEditor pocatecni={await nactiVzory()} />
    </div>
  );
}
