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
 * INSTALACE DO MOBILU JE NAHOŘE NATVRDO (upřesnění 25. 9. 2026: „měl by mít
 * pod otazníkem i v nápovědě návod na instalaci té aplikace do mobilu").
 * Schválně ne jen jako odstavec v textu návodu: kdo sem přijde hned po
 * přihlášení, hledá právě tohle - a QR kód se dá naskenovat z obrazovky
 * počítače telefonem, takže se člověk nemusí nikam přepisovat adresu.
 *
 * Celá sekce je anglicky - viz layout.
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

      {/* --- instalace do mobilu ------------------------------------------- */}
      <section className="bg-surface rounded-card border border-line shadow-sm p-6 sm:p-8 flex flex-col gap-5">
        <div>
          <h2 className="font-heading font-semibold text-ink text-lg m-0">Put it on your phone</h2>
          <p className="text-sm font-body text-muted m-0 mt-1">
            This calendar is a web app, so it goes on your home screen like any other app and opens
            full screen — no app store, no updates to chase.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-5 items-start">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/navody/studio-booking-qr.png"
            alt="QR code that opens the studio booking calendar"
            className="w-40 h-40 shrink-0 rounded-lg border border-line bg-white"
          />
          <div className="flex flex-col gap-4 min-w-0">
            <p className="text-sm font-body text-ink m-0">
              Point your phone camera at the code — or open{' '}
              <span className="font-heading text-brand-purple">msportal.cz/studio</span> on the phone
              and sign in.
            </p>

            <div>
              <h3 className="font-heading font-semibold text-sm text-ink m-0">iPhone &amp; iPad</h3>
              <ol className="text-sm font-body text-muted m-0 mt-1.5 pl-5 flex flex-col gap-1">
                <li>Open the calendar in Safari and sign in.</li>
                <li>
                  Tap <b className="text-ink">Share</b> — the square with the arrow.
                </li>
                <li>
                  Choose <b className="text-ink">Add to Home Screen</b>, then{' '}
                  <b className="text-ink">Add</b>.
                </li>
              </ol>
            </div>

            <div>
              <h3 className="font-heading font-semibold text-sm text-ink m-0">Android</h3>
              <ol className="text-sm font-body text-muted m-0 mt-1.5 pl-5 flex flex-col gap-1">
                <li>Open the calendar in Chrome and sign in.</li>
                <li>
                  Tap the <b className="text-ink">⋮</b> menu in the top right.
                </li>
                <li>
                  Choose <b className="text-ink">Install app</b> or{' '}
                  <b className="text-ink">Add to home screen</b>.
                </li>
              </ol>
            </div>
          </div>
        </div>

        <a
          href="/navody/studio-booking-install.pdf"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-heading text-brand-purple no-underline hover:underline"
        >
          One-page version to print or forward ↗
        </a>
      </section>

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
