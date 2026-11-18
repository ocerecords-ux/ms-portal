import { prisma } from '@/lib/db';
import { projektPodleTokenu } from '@/lib/preposlechOdkaz';
import { posluchacZCookie } from '@/lib/preposlechPristup';
import { FormularPodnetu } from './FormularPodnetu';

/**
 * PODNĚT K AUDIOTAGGERU (zadání 18. 11. 2026). Otevřená stránka z odkazu
 * v poděkování za kontrolní poslech - žádné přihlašování, jen token.
 *
 * Záměrně jedno pole a jedno tlačítko: kdo sem došel, chce napsat větu
 * a jít pryč, ne vyplňovat formulář.
 */
export const dynamic = 'force-dynamic';

export default async function StrankaPodnetu({ params }: { params: { token: string } }) {
  const caflouProjectId = await projektPodleTokenu(params.token);

  if (!caflouProjectId) {
    return (
      <main className="min-h-screen bg-paper text-ink grid place-items-center p-6">
        <div className="max-w-md text-center">
          <h1 className="font-heading font-bold text-xl mb-2">Odkaz už neplatí</h1>
          <p className="font-body text-sm text-muted">
            Napište nám prosím přímo na e-mail a my to zařídíme.
          </p>
        </div>
      </main>
    );
  }

  const [projekt, ja] = await Promise.all([
    prisma.projectMeta
      .findUnique({ where: { caflouProjectId }, select: { name: true } })
      .catch(() => null),
    posluchacZCookie(caflouProjectId),
  ]);

  return (
    <main className="min-h-screen bg-paper text-ink p-6 grid place-items-center">
      <div className="w-full max-w-lg bg-surface border border-line rounded-card p-6 sm:p-8">
        <h1 className="font-heading font-bold text-xl m-0">Podnět k AudioTaggeru</h1>
        <p className="font-body text-sm text-muted mt-1 mb-5">
          {[projekt?.name, ja?.jmeno || ja?.email].filter(Boolean).join(' · ') || 'Děkujeme'}
        </p>
        <FormularPodnetu token={params.token} znameAdresu={Boolean(ja?.email)} />
      </div>
    </main>
  );
}
