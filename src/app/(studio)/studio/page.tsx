import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { utcParts, zonedToUtc } from '@/lib/calendar';
import { nactiBookingPristup, nactiBookingUdalosti } from '@/lib/bookingServer';
import { nactiJazyk } from '@/lib/jazykServer';
import { prelozit } from '@/lib/jazyk';
import { BookingKalendar } from './BookingKalendar';

/**
 * KALENDÁŘ STUDIA PRO MUZIKANTY A PRODUCENTY (zadání 25. 9. 2026).
 *
 * Stránka jen zjistí, do kterého studia ten člověk patří, a připraví první
 * týden. Dál už si data tahá mřížka sama - listování po týdnech nemá kvůli
 * jedné šipce překreslovat celou stránku.
 */
export const dynamic = 'force-dynamic';

/** Pondělí toho týdne, ve kterém leží dnešek - v pásmu studia. */
function pondeliTydne(ted: Date, pasmo: string): Date {
  const p = utcParts(ted, pasmo);
  // Neděle je 0, ale týden začínáme pondělím.
  const posun = (p.weekday + 6) % 7;
  return zonedToUtc(p.year, p.month, p.day - posun, 0, pasmo);
}

export default async function StudioPage({
  searchParams,
}: {
  searchParams?: { studio?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  const jazyk = nactiJazyk();
  const pristup = await nactiBookingPristup(
    { id: session.user.id, role: session.user.role },
    searchParams?.studio ?? null,
  );

  if (!pristup) {
    return (
      <div className="bg-surface border border-line rounded-card shadow-sm px-6 py-10 text-center max-w-lg mx-auto">
        <h1 className="font-heading font-semibold text-ink text-lg m-0">
          {prelozit(jazyk, 'booking.bezPristupuNadpis')}
        </h1>
        <p className="text-sm font-body text-muted m-0 mt-2">
          {prelozit(jazyk, 'booking.bezPristupuText')}
        </p>
      </div>
    );
  }

  const zacatek = pondeliTydne(new Date(), pristup.studio.casovePasmo);
  const konec = new Date(zacatek.getTime() + 7 * 24 * 60 * 60 * 1000);
  const udalosti = await nactiBookingUdalosti(
    pristup.studio.id,
    zacatek,
    konec,
    session.user.id,
  );

  return (
    <BookingKalendar
      studio={pristup.studio}
      jenNahled={pristup.jenNahled}
      zacatek={zacatek.toISOString()}
      prvniUdalosti={udalosti}
    />
  );
}
