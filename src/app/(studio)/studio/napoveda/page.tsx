import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { navodNaHtml } from '@/lib/navody';

/**
 * NÁVOD PRO KLIENTY STUDIA (zadání 25. 9. 2026: „uděláš mi rovnou k tomu
 * návod s obrázkama v angličtině pro ty uživatele").
 *
 * VLASTNÍ STRÁNKA, NE PORTÁLOVÁ NÁPOVĚDA. Klient studia se do portálu
 * nedostane (layout ho pošle rovnou na kalendář), takže by na /napoveda
 * narazil na přesměrování. Tady čte totéž, jen ve své sekci.
 *
 * Text je obyčejný návod z administrace - píše se a upravuje v Návodech jako
 * všechny ostatní, jen má zaškrtnutou roli „Klient studia".
 */
export const dynamic = 'force-dynamic';

export default async function NapovedaStudia() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  const navody = await prisma.navod
    .findMany({
      where: { zverejneno: true, proRole: { has: 'BOOKING' } },
      orderBy: [{ poradi: 'asc' }, { nazev: 'asc' }],
    })
    .catch(() => []);

  return (
    <article className="flex flex-col gap-6 max-w-3xl mx-auto">
      <div>
        <Link href="/studio" className="text-sm font-heading text-muted no-underline">
          ← Back to the calendar
        </Link>
        <h1 className="font-display text-3xl text-ink m-0 mt-3">How to book the studio</h1>
      </div>

      {navody.length === 0 ? (
        <p className="text-sm font-body text-muted m-0">The guide is being written — check back soon.</p>
      ) : (
        navody.map((n) => (
          <section key={n.id} className="flex flex-col gap-3">
            {navody.length > 1 && (
              <h2 className="font-heading font-semibold text-ink text-lg m-0">{n.nazev}</h2>
            )}
            <div
              className="navod-text bg-surface rounded-card border border-line shadow-sm p-6 sm:p-8"
              dangerouslySetInnerHTML={{ __html: navodNaHtml(n.obsah) }}
            />
          </section>
        ))
      )}
    </article>
  );
}
