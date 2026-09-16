import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { DoplneniUdaju } from './DoplneniUdaju';

/**
 * DOPLNĚNÍ ÚDAJŮ HERCE (zadání 16. 9. 2026: „po tom, co si herec nastaví
 * heslo, ho to vyzve, ať doplní údaje. Jméno, adresu, číslo účtu a kde je
 * schopen točit, jestli je plátce DPH").
 *
 * STRÁNKA STOJÍ MIMO (portal), i když je za přihlášením. Právě portálová
 * část sem herce posílá — kdyby formulář ležel uvnitř ní, přesměrování by
 * poslalo herce znovu na sebe sama a portál by se zacyklil.
 *
 * Kdo má hotovo, sem nemá co chodit; ten se vrátí do portálu.
 */
export const dynamic = 'force-dynamic';

export default async function DoplnitUdajePage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  const ucet = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      name: true,
      udajeDoplneny: true,
      addressStreet: true,
      addressCity: true,
      addressZip: true,
      addressCountry: true,
      bankAccount: true,
      studioLocations: true,
      vatPayer: true,
    },
  });
  if (!ucet) redirect('/login');
  if (ucet.udajeDoplneny) redirect('/projekty');

  return (
    <main className="min-h-screen bg-paper">
      <header className="bg-gradient-to-b from-brand-purple to-brand-purpleDeep px-6 sm:px-10 py-6 flex items-center gap-3 sm:gap-4">
        <span className="font-body text-brand-green font-semibold text-2xl sm:text-3xl">Mediaspace</span>
        <span className="w-px h-8 sm:h-10 bg-white/40" aria-hidden="true" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/mediaspace-logo.gif" alt="Mediaspace" className="h-12 sm:h-14 w-auto" />
      </header>

      <div className="max-w-2xl mx-auto px-6 sm:px-10 py-8 sm:py-12">
        <DoplneniUdaju
          vychozi={{
            name: ucet.name ?? '',
            addressStreet: ucet.addressStreet ?? '',
            addressCity: ucet.addressCity ?? '',
            addressZip: ucet.addressZip ?? '',
            addressCountry: ucet.addressCountry ?? '',
            bankAccount: ucet.bankAccount ?? '',
            studioLocations: ucet.studioLocations ?? [],
            vatPayer: ucet.vatPayer ?? false,
          }}
        />
      </div>
    </main>
  );
}
