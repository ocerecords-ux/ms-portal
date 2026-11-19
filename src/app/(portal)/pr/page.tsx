import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';

import { authOptions } from '@/lib/auth';
import { nactiKampane, oStudiu } from '@/lib/emaServer';
import { formatDatum, prelozit, prelozitS } from '@/lib/jazyk';
import { nactiJazyk } from '@/lib/jazykServer';
import { isInternalRole } from '@/lib/roles';

import { NovaKampan, PodkladyEmy } from './PrKlient';

/**
 * PR A KOMUNIKACE - SEZNAM KAMPANÍ (zadání 19. 11. 2026: „chci ji ovládat
 * z MS portálu a vidět, co tam dělá").
 *
 * Tohle je Emina sekce. Kampaň je jedna akce - titul, novinka, spuštění
 * služby; v ní se zadává Emě práce a drží se seznam médií. Stálé podklady
 * o studiu jsou nad tím, ať se nepíšou do každé kampaně znovu.
 */
export const dynamic = 'force-dynamic';

export default async function PrPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');
  if (!isInternalRole(session.user.role)) redirect('/projekty');

  const jazyk = nactiJazyk();
  const kampane = await nactiKampane();
  const podklady = await oStudiu();

  return (
    <main className="p-4 sm:p-6 flex flex-col gap-5 max-w-[1100px]">
      <div>
        <h1 className="font-display text-3xl text-ink m-0">{prelozit(jazyk, 'pr.nadpis')}</h1>
        <p className="text-sm font-body text-muted m-0 mt-1.5">{prelozit(jazyk, 'pr.popis')}</p>
      </div>

      <NovaKampan jazyk={jazyk} />

      {kampane.length === 0 ? (
        <p className="text-sm font-body text-muted m-0">{prelozit(jazyk, 'pr.zadneKampane')}</p>
      ) : (
        <ul className="list-none p-0 m-0 flex flex-col gap-2">
          {kampane.map((k) => (
            <li key={k.id}>
              <Link
                href={`/pr/${k.id}`}
                className="flex flex-wrap items-center gap-3 rounded-card border border-line bg-surface px-4 py-3 no-underline hover:border-brand-purple transition-colors"
              >
                <span className="font-heading font-semibold text-sm text-ink grow min-w-[200px]">
                  {k.nazev}
                </span>
                <span className="text-xs font-body text-muted">
                  {prelozitS(jazyk, 'pr.souhrnKampane', {
                    ukoly: k.pocetUkolu,
                    media: k.pocetMedii,
                    odeslano: k.pocetOdeslanych,
                  })}
                </span>
                <span className="text-xs font-body text-muted">
                  {formatDatum(jazyk, new Date(k.createdAt))}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <PodkladyEmy jazyk={jazyk} pocatecni={podklady} />
    </main>
  );
}
