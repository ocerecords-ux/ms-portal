import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { odkazNaFotku } from '@/lib/fotky';
import { initials } from '@/lib/chat';
import { prelozit, type Jazyk } from '@/lib/jazyk';
import { JazykProvider } from '@/app/(portal)/components/JazykProvider';
import { canManageCalendar, isInternalRole } from '@/lib/roles';
import { maStudioSRezervacemi } from '@/lib/bookingServer';
import { ThemeToggle } from '@/app/(portal)/components/ThemeToggle';
import { OdhlasitSe } from './studio/OdhlasitSe';

/**
 * SEKCE STUDIA (zadání 25. 9. 2026: „poslali bychom tomu člověku pozvánku
 * a on by se dostal jen do toho kalendáře").
 *
 * VLASTNÍ SKUPINA, NE ZÁLOŽKA V PORTÁLU. Portálový layout tahá lištu, úkoly,
 * chat, zvonek a rychlé volby - tedy přesně to, co člověk zvenčí vidět nemá.
 * Tady je jen hlavička s logem, nápovědou, přihlášeným člověkem a odhlášením.
 *
 * CELÁ SEKCE JE ANGLICKY, a to britsky (upřesnění 25. 9. 2026). Jazyk se
 * tu nepřepíná - viz poznámka u proměnné `jazyk` níž.
 */
export const metadata: Metadata = {
  title: 'Studio booking',
  description: 'Book studio time with Mediaspace.',
  applicationName: 'MS Studio',
  // Vlastní manifest = vlastní ikona na ploše telefonu, nezávisle na portálu.
  manifest: '/manifest-studio.webmanifest',
  appleWebApp: { capable: true, title: 'MS Studio', statusBarStyle: 'default' },
};

/**
 * KDO SE SEM DOSTANE (oprava 28. 9. 2026: „Matějovi Černému se děje, že když
 * klikne na Studia na hlavním panelu, tak se tam nedostane, dostane se na
 * projekty").
 *
 * Lišta a tahle stránka se neshodly. Odkaz do lišty přidává
 * `maStudioSRezervacemi` - tedy KDO STUDIO S REZERVACEMI SPRAVUJE, což je
 * i vedoucí pobočky. Sem se ale pouštělo podle ROLE, a v seznamu zvukař
 * nebyl. Matěj Černý je zvukař a zároveň vedoucí londýnského studia: odkaz
 * v liště viděl, a klik ho vyhodil na projekty.
 *
 * Teď o obojím rozhoduje tatáž funkce, takže se ta dvě místa nemůžou
 * rozejít znovu. Role zůstávají jako zkratka pro ty, kdo sem chodí vždycky:
 * BOOKING je klient studia zvenčí (ten žádné studio nespravuje) a produkce
 * se Žůžo-labůžo sem musí dovnitř i ve chvíli, kdy zrovna žádné studio
 * rezervace zapnuté nemá.
 */
async function smiDoStudia(user: { id: string; role: string }): Promise<boolean> {
  if (user.role === 'BOOKING') return true;
  if (canManageCalendar(user.role as never)) return true;
  return maStudioSRezervacemi(user);
}

export default async function StudioLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  if (!(await smiDoStudia({ id: session.user.id, role: session.user.role }))) redirect('/projekty');

  /**
   * CELÁ SEKCE JE VÝHRADNĚ ANGLICKY (upřesnění 25. 9. 2026: „žádné přepínání
   * jazyka taky v tom rezervačním systému. Musí to být výhradně v angličtině.
   * Britské.").
   *
   * Platí to i pro nás: kdo se sem podívá, má vidět přesně to, co uvidí
   * klient studia - jinak se nepozná, že někde zůstal český text. Přepínač
   * jazyka tu proto není vůbec; jazyk portálu se sem nepromítá.
   */
  const jazyk: Jazyk = 'en';

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

  /**
   * LOGO JE CESTA VEN (hlášení Matěje Černého 14. 10. 2026: „ze záložky
   * Studio mi nefunguje logo jako home button" — ze stránky studia se pak
   * nedostal zpátky do portálu).
   *
   * Sekce studia je schválně holá: žádná lišta, žádné menu. Pro klienta
   * studia zvenku je to v pořádku, ten tu je doma. Ale chodíme sem i my —
   * vedoucí pobočky si tu spravuje rezervace — a pro nás to byla slepá
   * ulice: ven vedlo jen tlačítko Odhlásit nebo ruční přepisování adresy.
   *
   * Logo proto vede DOMŮ, a domů znamená u každého něco jiného: nás vrátí
   * do portálu, klienta studia nechá na rezervacích. Tím se klient zvenku
   * nedozví o ničem, co vidět nemá.
   */
  const jsemZTymu = isInternalRole(session.user.role as never);
  const domu = jsemZTymu ? '/projekty' : '/studio';

  return (
    <JazykProvider jazyk={jazyk}>
      <div className="min-h-screen bg-paper flex flex-col">
        <header className="bg-gradient-to-r from-brand-purple to-brand-purpleDeep text-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
            <span className="flex items-center gap-2.5 min-w-0">
              {/* Pohyblivé logo Mediaspace (25. 9. 2026) - stejné jako na
                  přihlášení, ne zkratka MS. Od 14. 10. 2026 je to odkaz domů,
                  viz `domu` výše. */}
              <Link
                href={domu}
                title={jsemZTymu ? 'Back to MS Portal' : 'Studio booking'}
                aria-label={jsemZTymu ? 'Back to MS Portal' : 'Studio booking'}
                className="shrink-0 no-underline"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/mediaspace-logo.gif"
                  alt="Mediaspace"
                  className="h-9 sm:h-10 w-auto shrink-0"
                />
              </Link>
              <span className="w-px h-6 bg-white/40 shrink-0" aria-hidden="true" />
              {/* Zároveň i druhá, větší plocha na totéž - kdo míří na nápis,
                  chce též domů. */}
              <Link
                href={domu}
                className="font-heading font-semibold text-sm sm:text-base truncate text-white no-underline hover:text-brand-green transition-colors"
              >
                Studio booking
              </Link>
            </span>
            <span className="flex items-center gap-2 shrink-0">
              {/* Cesta ven i NAPSANÁ, ne jen schovaná v logu (14. 10. 2026).
                  Kdo sem přišel z portálu, má vidět, kudy zpátky; klient studia
                  zvenku žádný portál nemá a nic takového se mu neukáže. */}
              {jsemZTymu && (
                <Link
                  href="/projekty"
                  className="rounded-pill border border-white/25 px-3 py-1 text-[11px] font-heading font-semibold text-white/85 hover:text-white hover:border-white/50 transition-colors no-underline whitespace-nowrap"
                >
                  ← MS Portal
                </Link>
              )}
              <Link
                href="/studio/napoveda"
                title="Help"
                aria-label="Help"
                className="rounded-pill border border-white/25 px-3 py-1 text-[11px] font-heading font-semibold text-white/85 hover:text-white hover:border-white/50 transition-colors no-underline"
              >
                ?
              </Link>
              <ThemeToggle anglicky />
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
