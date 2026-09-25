import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { nactiJazyk } from '@/lib/jazykServer';
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

  const jazyk = nactiJazyk();

  return (
    <JazykProvider jazyk={jazyk}>
      <div className="min-h-screen bg-paper flex flex-col">
        <header className="bg-gradient-to-r from-brand-purple to-brand-purpleDeep text-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
            <span className="flex items-center gap-2.5 min-w-0">
              <span className="font-body text-brand-green font-semibold text-lg sm:text-xl">MS</span>
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
              <PrepinacJazyka />
              <ThemeToggle />
              <OdhlasitSe />
            </span>
          </div>
        </header>
        <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-5">{children}</main>
      </div>
    </JazykProvider>
  );
}
