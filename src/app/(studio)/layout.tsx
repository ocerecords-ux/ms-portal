import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { odkazNaFotku } from '@/lib/fotky';
import { initials } from '@/lib/chat';
import { nactiJazyk } from '@/lib/jazykServer';
import { prelozit } from '@/lib/jazyk';
import { JazykProvider } from '@/app/(portal)/components/JazykProvider';
import { PrepinacJazyka } from '@/app/(portal)/components/PrepinacJazyka';
import { ThemeToggle } from '@/app/(portal)/components/ThemeToggle';
import { OdhlasitSe } from './studio/OdhlasitSe';

/**
 * SEKCE STUDIA (zadání 25. 9. 2026: „poslali bychom tomu člověku pozvánku
 * a on by se dostal jen do toho kalendáře").
 *
 * VLASTNÍ SKUPINA, NE ZÁLOŽKA V PORTÁLU. Portálový layout tahá lištu, úkoly,
 * chat, zvonek a rychlé volby - tedy přesně to, co člověk zvenčí vidět nemá.
 * Tady je jen hlavička s názvem studia, přepínačem jazyka a odhlášením.
 *
 * JAZYK SE ŘÍDÍ PŘEPÍNAČEM PORTÁLU (upřesnění 25. 9. 2026: „tam to může být
 * primárně podle jazyka, který je zrovna zaplý v portálu"). Londýnští klienti
 * si přepnou EN a mají celý kalendář anglicky; my ho vidíme česky.
 */
export const metadata: Metadata = {
  title: 'Studio booking',
  description: 'Book studio time with Mediaspace.',
  applicationName: 'MS Studio',
  // Vlastní manifest = vlastní ikona na ploše telefonu, nezávisle na portálu.
  manifest: '/manifest-studio.webmanifest',
  appleWebApp: { capable: true, title: 'MS Studio', statusBarStyle: 'default' },
};

/** Kdo se sem dostane: klient studia a náš tým (na nahlédnutí). */
const SMI = ['BOOKING', 'ADMIN', 'PRODUKCE'];

export default async function StudioLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  if (!SMI.includes(session.user.role)) redirect('/projekty');

  /**
   * KLIENT STUDIA VIDÍ VŽDYCKY ANGLIČTINU (upřesnění 25. 9. 2026: „na straně
   * klienta nech jen zaplou angličtinu. Myslel jsem podle nastavení portálu
   * jen tu administraci z naší strany").
   *
   * Muzikant z Londýna nemá co řešit, že portál někde uvnitř umí i česky -
   * a přepínač, který mu celý kalendář přehodí do jazyka, kterému nerozumí,
   * je past, ne funkce. Náš tým si kalendář otevírá v jazyce portálu.
   */
  const klientStudia = session.user.role === 'BOOKING';
  const jazyk = klientStudia ? 'en' : nactiJazyk();

  /**
   * KDO JE PŘIHLÁŠENÝ (zadání 25. 9. 2026: „pak by tam měl být vidět uživatel,
   * který je přihlášený zrovna jako je to na portálu"). Stejný chip jako
   * v liště portálu - fotka nebo iniciály a jméno, klepnutí vede na účet.
   */
  const ucet = await prisma.user
    .findUnique({
      where: { id: session.user.id },
      select: { name: true, email: true, maFotku: true },
    })
    .catch(() => null);
  const jmeno = ucet?.name?.trim() || ucet?.email || session.user.email || '';
  const fotka = odkazNaFotku(session.user.id, ucet?.maFotku);

  return (
    <JazykProvider jazyk={jazyk}>
      <div className="min-h-screen bg-paper flex flex-col">
        <header className="bg-gradient-to-r from-brand-purple to-brand-purpleDeep text-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
            <span className="flex items-center gap-2.5 min-w-0">
              {/* Pohyblivé logo Mediaspace (25. 9. 2026) - stejné jako na
                  přihlášení, ne zkratka MS. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/mediaspace-logo.gif"
                alt="Mediaspace"
                className="h-9 sm:h-10 w-auto shrink-0"
              />
              <span className="w-px h-6 bg-white/40 shrink-0" aria-hidden="true" />
              <span className="font-heading font-semibold text-sm sm:text-base truncate">
                Studio booking
              </span>
            </span>
            <span className="flex items-center gap-2 shrink-0">
              <Link
                href="/studio/napoveda"
                className="rounded-pill border border-white/25 px-3 py-1 text-[11px] font-heading font-semibold text-white/85 hover:text-white hover:border-white/50 transition-colors no-underline"
              >
                ?
              </Link>
              {!klientStudia && <PrepinacJazyka />}
              <ThemeToggle />
              {/* Přihlášený člověk - klepnutí vede na jeho účet a upozornění. */}
              <Link
                href="/studio/ucet"
                title={prelozit(jazyk, 'booking.mujUcet')}
                className="flex items-center gap-2 text-sm font-heading text-brand-green bg-white/10 border border-white/20 rounded-pill p-1 sm:pl-1 sm:pr-3 no-underline hover:bg-white/20 transition-colors"
              >
                {fotka ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={fotka} alt="" className="w-7 h-7 rounded-full object-cover shrink-0 bg-white/20" />
                ) : (
                  <span className="w-7 h-7 rounded-full bg-white/20 text-white text-[11px] font-semibold grid place-items-center shrink-0">
                    {initials(jmeno)}
                  </span>
                )}
                <span className="hidden sm:inline max-w-[160px] truncate">{jmeno}</span>
              </Link>
              <OdhlasitSe />
            </span>
          </div>
        </header>
        <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-5">{children}</main>
      </div>
    </JazykProvider>
  );
}
