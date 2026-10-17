import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { dropboxNastaven } from '@/lib/dropbox';
import { nactiKnihovnu, projektyBezHudby } from '@/lib/hudbaKnihovnaServer';
import { prehledSerii } from '@/lib/hudbaSerieServer';
import { nactiJazyk } from '@/lib/jazykServer';
import { prelozit } from '@/lib/jazyk';

import { HudbaAudioknih } from './HudbaAudioknih';

/**
 * HUDBA K AUDIOKNIHÁM (zadání 17. 10. 2026: „ještě bychom měli dát někde
 * samostatnou stránku hudba-audioknihy, kde budeme spravovat databázi. Taky
 * bych tam chtěl mít možnost dodatečně přidávat a upravovat hudbu k sériím
 * a projektům").
 *
 * Tři pohledy: co všechno jsme kdy použili, co se používá v celé sérii a kde
 * hudba chybí, i když se blíží natáčení. Karta u projektu zůstává tam, kde
 * byla - tahle stránka je nad ní, ne místo ní.
 */
export const dynamic = 'force-dynamic';

const SMI = ['ADMIN', 'PRODUKCE'];

export default async function HudbaAudioknihPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  if (!SMI.includes(session.user.role)) redirect('/projekty');

  const [knihovna, serie, chybi, firmy] = await Promise.all([
    nactiKnihovnu(),
    prehledSerii(),
    projektyBezHudby(),
    prisma.company
      .findMany({
        where: { type: 'KLIENT', active: true },
        orderBy: { name: 'asc' },
        select: { id: true, name: true },
      })
      .catch(() => []),
  ]);

  const jazyk = nactiJazyk();

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h1 className="hidden sm:block font-display text-3xl text-ink m-0">
          {prelozit(jazyk, 'hudbaKnihovna.nadpis')}
        </h1>
        <p className="text-sm font-body text-muted m-0 mt-1">
          {prelozit(jazyk, 'hudbaKnihovna.uvod')}
        </p>
      </div>

      <HudbaAudioknih
        knihovna={knihovna}
        serie={serie}
        chybi={chybi}
        firmy={firmy as { id: string; name: string }[]}
        dropboxNastaven={dropboxNastaven()}
      />
    </section>
  );
}
