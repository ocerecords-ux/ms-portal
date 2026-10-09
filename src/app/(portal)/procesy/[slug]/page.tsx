import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import type { Role } from '@prisma/client';
import { isInternalRole, nazevRole } from '@/lib/roles';
import { navodNaHtml, vidiNavod } from '@/lib/navody';
import { StahnoutPdf } from '@/app/(portal)/napoveda/[slug]/StahnoutPdf';
import { nactiJazyk } from '@/lib/jazykServer';
import { formatDatum, prelozit, prelozitS } from '@/lib/jazyk';

/**
 * JEDEN PROCES (zadání 28. 9. 2026). Text se skládá na serveru z Markdownu,
 * stejně jako nápověda - článek je na čtení, ne na klikání.
 *
 * Článek psaný pro jinou roli se tváří, jako by nebyl. Šedý zámek by jen
 * říkal „tohle si přečíst nesmíš", a to je informace, kterou nikdo nepotřebuje.
 */
export const dynamic = 'force-dynamic';

export default async function ProcesPage({ params }: { params: { slug: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  const role = session.user.role;
  if (!isInternalRole(role)) redirect('/projekty');
  const jeAdmin = role === 'ADMIN';
  const jazyk = nactiJazyk();

  const clanek = (await prisma.navod.findUnique({
    where: { slug: params.slug },
    include: { autor: { select: { name: true } } },
  })) as {
    id: string;
    druh: string;
    nazev: string;
    perex: string | null;
    kategorie: string;
    obsah: string;
    zverejneno: boolean;
    proRole: string[];
    updatedAt: Date;
    autor: { name: string | null } | null;
  } | null;

  if (!clanek || clanek.druh !== 'PROCES') notFound();
  if (!clanek.zverejneno && !jeAdmin) notFound();
  if (!vidiNavod(clanek.proRole ?? [], role)) notFound();

  const proKoho = (clanek.proRole ?? []).length
    ? clanek.proRole.map((r) => nazevRole(r as Role, jazyk) ?? r).join(', ')
    : prelozit(jazyk, 'procesy.celyTymMediaspace');

  return (
    <article className="tisk flex flex-col gap-6 max-w-3xl">
      <div>
        <Link href="/procesy" className="netisknout text-sm font-heading text-muted no-underline">
          {prelozit(jazyk, 'procesy.zpet')}
        </Link>
        <p className="text-xs font-heading text-muted uppercase tracking-wide m-0 mt-3">
          {clanek.kategorie}
        </p>
        <h1 className="font-display text-3xl sm:text-4xl text-ink m-0 mt-1">{clanek.nazev}</h1>
        {clanek.perex && <p className="text-muted font-body m-0 mt-2">{clanek.perex}</p>}
        <p className="text-xs font-body text-muted m-0 mt-3">
          {prelozitS(jazyk, 'procesy.proKohoUpraveno', {
            kdo: proKoho,
            datum: formatDatum(jazyk, clanek.updatedAt),
          })}
          {clanek.autor?.name ? ` · ${clanek.autor.name}` : ''}
          {!clanek.zverejneno ? prelozit(jazyk, 'procesy.rozepsaneNevidi') : ''}
        </p>
      </div>

      <div
        className="navod-text bg-surface rounded-card border border-line shadow-sm p-6 sm:p-8"
        dangerouslySetInnerHTML={{ __html: navodNaHtml(clanek.obsah) }}
      />

      <div className="netisknout flex items-center gap-2 flex-wrap">
        <StahnoutPdf nazev={`MS portal – ${clanek.nazev}`} />
        {jeAdmin && (
          <Link
            href={`/admin/navody/${clanek.id}`}
            className="text-sm font-heading font-semibold rounded-pill border border-line text-ink px-4 py-2 no-underline hover:border-brand-purple"
          >
            {prelozit(jazyk, 'procesy.upravit')}
          </Link>
        )}
      </div>
    </article>
  );
}
