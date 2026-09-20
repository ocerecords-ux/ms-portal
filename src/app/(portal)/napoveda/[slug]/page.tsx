import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { navodNaHtml, vidiNavod } from '@/lib/navody';
import { StahnoutPdf } from './StahnoutPdf';

/**
 * JEDEN NÁVOD (zadání 16. 9. 2026).
 *
 * Text se vykresluje na serveru — návod je na čtení, ne na klikání, takže
 * nemá smysl posílat do prohlížeče překladač Markdownu.
 */
export const dynamic = 'force-dynamic';

export default async function NavodPage({ params }: { params: { slug: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  const role = session.user.role;
  const jeAdmin = role === 'ADMIN';

  const navod = await prisma.navod.findUnique({
    where: { slug: params.slug },
    include: { autor: { select: { name: true } } },
  });
  if (!navod) notFound();
  // Rozepsaný návod a návod psaný pro jinou roli se tváří, jako by nebyl.
  if (!navod.zverejneno && !jeAdmin) notFound();
  if (!vidiNavod(navod.proRole, role)) notFound();

  return (
    // `tisk` = co se má dostat do PDF (styly pro tisk jsou v globals.css).
    <article className="tisk flex flex-col gap-6 max-w-3xl">
      <div>
        <Link href="/napoveda" className="netisknout text-sm font-heading text-muted no-underline">
          ← Nápověda
        </Link>
        <p className="text-xs font-heading text-muted uppercase tracking-wide m-0 mt-3">
          {navod.kategorie}
        </p>
        <h1 className="font-display text-3xl sm:text-4xl text-ink m-0 mt-1">{navod.nazev}</h1>
        {navod.perex && <p className="text-muted font-body m-0 mt-2">{navod.perex}</p>}
        <p className="text-xs font-body text-muted m-0 mt-3">
          Upraveno {navod.updatedAt.toLocaleDateString('cs-CZ', { timeZone: 'Europe/Prague' })}
          {navod.autor?.name ? ` · ${navod.autor.name}` : ''}
          {!navod.zverejneno ? ' · rozepsané, ostatní ho nevidí' : ''}
        </p>
      </div>

      {/* Text návodu. Styly jsou tady, ne v komponentě - obsah je HTML
          složené na serveru z Markdownu (viz lib/navody.ts). */}
      <div
        className="navod-text bg-surface rounded-card border border-line shadow-sm p-6 sm:p-8"
        dangerouslySetInnerHTML={{ __html: navodNaHtml(navod.obsah) }}
      />

      <div className="netisknout flex items-center gap-2 flex-wrap">
        {/* PDF (20. 9. 2026): tisk prohlizece → „Uložit jako PDF". */}
        <StahnoutPdf nazev={`MS portal – ${navod.nazev}`} />
        {jeAdmin && (
          <Link
            href={`/admin/navody/${navod.id}`}
            className="text-sm font-heading font-semibold rounded-pill border border-line text-ink px-4 py-2 no-underline hover:border-brand-purple"
          >
            Upravit návod
          </Link>
        )}
      </div>
    </article>
  );
}
