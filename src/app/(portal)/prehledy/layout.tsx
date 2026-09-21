import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { ZalozkyPrehledu } from './ZalozkyPrehledu';

/**
 * PŘEHLEDY (zadání 20. 9. 2026) - společná hlavička sekce se záložkami.
 * Každý přehled je vlastní stránka, takže se dá poslat odkazem i s vybraným
 * měsícem.
 */
export default async function PrehledyLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  return (
    <div className="flex flex-col gap-5">
      <h1 className="hidden sm:block font-display text-3xl sm:text-4xl text-ink m-0">Přehledy</h1>
      <ZalozkyPrehledu role={session?.user?.role ?? null} />
      {children}
    </div>
  );
}
