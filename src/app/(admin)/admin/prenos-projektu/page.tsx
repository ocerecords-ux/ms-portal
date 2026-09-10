import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PrenosPanel } from './PrenosPanel';

/**
 * Přenos projektů z Caflou (zadání 10. 9. 2026).
 *
 * Stránka schválně není v menu - je to jednorázový krok před odpojením
 * Caflou, ne něco, co má někdo denně po ruce.
 */
export const dynamic = 'force-dynamic';

export default async function PrenosProjektuPage() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'ADMIN') redirect('/projekty');

  return (
    <div className="flex flex-col gap-6">
      <Link href="/admin" className="text-muted text-sm font-heading no-underline">
        ← Zpět do administrace
      </Link>
      <h1 className="font-display text-3xl sm:text-4xl text-ink m-0">Přenos projektů z Caflou</h1>
      <PrenosPanel />
    </div>
  );
}
