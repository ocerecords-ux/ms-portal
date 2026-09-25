import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { prelozit } from '@/lib/jazyk';
import { nactiJazyk } from '@/lib/jazykServer';
import { UcetForm } from './UcetForm';

/**
 * ÚČET KLIENTA STUDIA (zadání 25. 9. 2026: „pod kliknutím na jméno by měl jít
 * nastavit osobní profil a různé notifikace, změny termínů a pod").
 *
 * VLASTNÍ STRÁNKA, NE PORTÁLOVÝ „Můj účet": ten je plný věcí, které se klienta
 * studia netýkají (fakturační údaje, podpis smluv, ranní přehled, upozornění
 * chatu) a klient se do portálu stejně nedostane.
 */
export const dynamic = 'force-dynamic';

export default async function UcetStudia() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  const jazyk = session.user.role === 'BOOKING' ? 'en' : nactiJazyk();
  const ucet = (await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      name: true,
      email: true,
      phone: true,
      bookingMailPotvrzeni: true,
      bookingMailZmena: true,
      bookingMailPripominka: true,
    },
  })) as unknown as {
    name: string | null;
    email: string;
    phone: string | null;
    bookingMailPotvrzeni: boolean;
    bookingMailZmena: boolean;
    bookingMailPripominka: boolean;
  } | null;

  if (!ucet) redirect('/login');

  return (
    <div className="flex flex-col gap-5 max-w-xl mx-auto">
      <div>
        <Link href="/studio" className="text-sm font-heading text-muted no-underline">
          ← {prelozit(jazyk, 'booking.zpetKalendar')}
        </Link>
        <h1 className="font-display text-2xl sm:text-3xl text-ink m-0 mt-3">
          {prelozit(jazyk, 'booking.mujUcet')}
        </h1>
      </div>

      <UcetForm
        jmeno={ucet.name ?? ''}
        email={ucet.email}
        telefon={ucet.phone ?? ''}
        potvrzeni={ucet.bookingMailPotvrzeni}
        zmena={ucet.bookingMailZmena}
        pripominka={ucet.bookingMailPripominka}
      />
    </div>
  );
}
