import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { NavodForm } from './NavodForm';
import { nactiJazyk } from '@/lib/jazykServer';
import { prelozit, prelozitKolem } from '@/lib/jazyk';

/** Psaní jednoho návodu (zadání 16. 9. 2026). */
export const dynamic = 'force-dynamic';

export default async function NavodEditPage({ params }: { params: { id: string } }) {
  const jazyk = nactiJazyk();
  const navod = await prisma.navod.findUnique({ where: { id: params.id } });
  if (!navod) notFound();

  return (
    <section className="flex flex-col gap-6 max-w-4xl">
      <div>
        <Link href="/admin/navody" className="text-sm font-heading text-muted no-underline">
          {prelozit(jazyk, 'navod.zpetNaNavody')}
        </Link>
        <h1 className="font-display text-3xl text-ink m-0 mt-2">{navod.nazev}</h1>
        <p className="text-sm font-body text-muted m-0 mt-1">
          {prelozitKolem(jazyk, 'navod.adresa', 'adresa')[0]}
          <code>/napoveda/{navod.slug}</code>
          {prelozitKolem(jazyk, 'navod.adresa', 'adresa')[1]}
          {' · '}
          <Link href={`/napoveda/${navod.slug}`} className="text-brand-purple no-underline">
            {prelozit(jazyk, 'navod.jakToUvidiOstatni')}
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
