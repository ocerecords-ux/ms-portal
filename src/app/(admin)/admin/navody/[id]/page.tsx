import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { NavodForm } from './NavodForm';

/** Psaní jednoho návodu (zadání 16. 9. 2026). */
export const dynamic = 'force-dynamic';

export default async function NavodEditPage({ params }: { params: { id: string } }) {
  const navod = await prisma.navod.findUnique({ where: { id: params.id } });
  if (!navod) notFound();

  return (
    <section className="flex flex-col gap-6 max-w-4xl">
      <div>
        <Link href="/admin/navody" className="text-sm font-heading text-muted no-underline">
          ← Návody
        </Link>
        <h1 className="font-display text-3xl text-ink m-0 mt-2">{navod.nazev}</h1>
        <p className="text-sm font-body text-muted m-0 mt-1">
          Adresa: <code>/napoveda/{navod.slug}</code>
          {' · '}
          <Link href={`/napoveda/${navod.slug}`} className="text-brand-purple no-underline">
            Zobrazit, jak to uvidí ostatní
          </Link>
        </p>
      </div>

      <NavodForm
        navod={{
          id: navod.id,
          nazev: navod.nazev,
          perex: navod.perex ?? '',
          kategorie: navod.kategorie,
          obsah: navod.obsah,
          poradi: navod.poradi,
          zverejneno: navod.zverejneno,
          proRole: navod.proRole,
          proDruhy: navod.proDruhy ?? [],
        }}
      />
    </section>
  );
}
