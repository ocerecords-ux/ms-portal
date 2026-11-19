import { notFound } from 'next/navigation';

import { formatDatum, prelozit, prelozitS } from '@/lib/jazyk';
import { nactiJazyk } from '@/lib/jazykServer';
import { nactiTracklist } from '@/lib/tracklistServer';
import { projektPodleTokenu } from '@/lib/vyzvaHudbaServer';

import { HudbaOdKlienta } from './HudbaOdKlienta';
import { TracklistOdKlienta } from './TracklistOdKlienta';

/**
 * HUDBA OD KLIENTA - VEŘEJNÁ STRÁNKA (zadání 17. 10. 2026: „měla by jít
 * notifikace emailem na klienta s možností vložit hudbu a ta by se propsala
 * přímo do karty").
 *
 * Člověk sem přijde z e-mailu odkazem s tokenem, nikam se nepřihlašuje
 * a nikam neopisuje kód - stejně jako u podpisu smlouvy. Projekt se hledá
 * VÝHRADNĚ podle tokenu, takže se z odkazu nedá dostat nikam jinam.
 */
export const dynamic = 'force-dynamic';

export default async function HudbaOdKlientaPage({ params }: { params: { token: string } }) {
  const token = params.token;
  const jazyk = nactiJazyk();
  const projekt = await projektPodleTokenu(token);
  if (!projekt) notFound();

  const termin = projekt.prvniFrekvence ? new Date(projekt.prvniFrekvence) : null;

  return (
    <main className="min-h-screen bg-paper">
      <header className="bg-gradient-to-b from-brand-purple to-brand-purpleDeep px-6 sm:px-10 py-6 flex items-center gap-3 sm:gap-4">
        <span className="font-body text-brand-green font-semibold text-2xl sm:text-3xl">
          Mediaspace
        </span>
        <span className="w-px h-8 sm:h-10 bg-white/40" aria-hidden="true" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/mediaspace-logo.gif" alt="Mediaspace" className="h-12 sm:h-14 w-auto" />
      </header>

      {/* Širší než dřív (19. 11. 2026): vedle vkládání hudby je tu teď
          i tabulka tracklistu a ta se do úzkého sloupce nevejde. */}
      <div className="max-w-4xl mx-auto px-6 sm:px-10 py-8 sm:py-12 flex flex-col gap-6">
        <div>
          <p className="text-xs font-heading text-muted uppercase tracking-wide m-0">
            {prelozit(jazyk, 'hudbaKlient.stitek')}
          </p>
          <h1 className="font-display text-3xl sm:text-4xl text-ink m-0 mt-1">
            {projekt.nazevProjektu}
          </h1>
          <p className="text-muted text-sm mt-2 font-body m-0">
            {[
              projekt.firma,
              termin
                ? // Datum podle jazyka (dávka 7n): skládalo se natvrdo česky, takže
                  // anglická věta končila českým datem. Klient to vidí venku.
                  prelozitS(jazyk, 'hudbaKlient.prvniDen', {
                    datum: formatDatum(jazyk, termin),
                  })
                : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>

        <HudbaOdKlienta token={token} jazyk={jazyk} uzVlozeno={Boolean(projekt.vlozenoAt)} />

        {/* TRACKLIST (19. 11. 2026) - jen u firem, které ho dodávají taky.
            Stejný editor jako máme my, viz TracklistOdKlienta.tsx. */}
        {projekt.tracklist && (
          <>
            <hr className="border-0 border-t border-line m-0" />
            <TracklistOdKlienta
              token={token}
              caflouProjectId={projekt.caflouProjectId}
              nazevProjektu={projekt.nazevProjektu}
              pocatecni={await nactiTracklist(projekt.caflouProjectId)}
              jazyk={jazyk}
            />
          </>
        )}
      </div>
    </main>
  );
}
