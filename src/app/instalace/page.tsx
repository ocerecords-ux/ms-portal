import type { Metadata } from 'next';
import { APLIKACE, adresaAplikace, type Aplikace } from '@/lib/aplikace';
import { qrSvg } from '@/lib/qr';

/**
 * Navod k instalaci obou aplikaci (zadani 10. 9. 2026: "nemuzu dat lidem jen
 * nejaky QR kod?").
 *
 * Verejna stranka - schvalne bez prihlaseni. Clovek, ktery si aplikaci teprve
 * dava na plochu, casto jeste ucet nema nebo ho ma na jinem telefonu; kdyby
 * ho stranka nejdriv poslala na prihlaseni, navod by nikdy neuvidel.
 * Nic tajneho tu neni, jen dve adresy a postup.
 *
 * QR kody se kresli na serveru pri kazdem otevreni. Je to zlomek milisekundy
 * a odpada tim starost, jestli je predgenerovany obrazek jeste aktualni.
 */
export const metadata: Metadata = {
  title: 'Nainstalovat do telefonu — MS Portal',
  description: 'Jak si přidat MS Portal a MS Chat na plochu telefonu.',
};

export const dynamic = 'force-dynamic';

export default async function InstalacePage() {
  const karty = await Promise.all(
    APLIKACE.map(async (aplikace) => ({
      aplikace,
      adresa: adresaAplikace(aplikace),
      svg: await qrSvg(adresaAplikace(aplikace)),
    })),
  );

  return (
    <main className="min-h-screen bg-paper">
      <header className="bg-gradient-to-b from-brand-purple to-brand-purpleDeep px-6 sm:px-10 py-6 flex items-center gap-3 sm:gap-4">
        <span className="font-body text-brand-green font-semibold text-2xl sm:text-3xl">MS portal</span>
        <span className="w-px h-8 sm:h-10 bg-white/40" aria-hidden="true" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/mediaspace-logo.gif" alt="Mediaspace" className="h-12 sm:h-14 w-auto" />
      </header>

      <div className="max-w-4xl mx-auto px-6 sm:px-10 py-8 sm:py-12 flex flex-col gap-8">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl text-ink m-0">Nainstalovat do telefonu</h1>
          <p className="text-muted font-body m-0 mt-3 max-w-2xl">
            Namiřte na kód fotoaparát telefonu a otevřete adresu, která se nabídne. Pak už jen dva
            kroky podle návodu níž a aplikace vám přistane na ploše — s vlastní ikonou, na celou
            obrazovku, bez adresního řádku prohlížeče. Nic se nestahuje z App Storu ani z Google Play.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {karty.map(({ aplikace, adresa, svg }) => (
            <KartaAplikace key={aplikace.klic} aplikace={aplikace} adresa={adresa} svg={svg} />
          ))}
        </div>

        <Navod />

        <p className="text-sm text-muted font-body m-0">
          Aplikace se přihlašuje stejným účtem jako portál v prohlížeči. Kdo účet ještě nemá, ozve se
          nám a založíme mu ho — bez něj se dovnitř nedostane.
        </p>
      </div>
    </main>
  );
}

function KartaAplikace({ aplikace, adresa, svg }: { aplikace: Aplikace; adresa: string; svg: string }) {
  return (
    <section className="bg-surface rounded-card border border-line shadow-sm p-6 flex flex-col items-center text-center gap-4">
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={aplikace.ikona} alt="" className="w-10 h-10 rounded-[10px]" />
        <h2 className="font-heading font-semibold text-xl text-ink m-0">{aplikace.nazev}</h2>
      </div>

      <p className="text-sm text-muted font-body m-0">{aplikace.popis}</p>

      {/* Bily ramecek i v tmavem rezimu - ctecky chteji tmavy kod na svetlem. */}
      <div
        className="bg-white rounded-xl p-3 w-full max-w-[240px] [&>svg]:block [&>svg]:w-full [&>svg]:h-auto"
        // QR je hotove SVG ze serveru, zadny cizi vstup se do nej nedostane.
        dangerouslySetInnerHTML={{ __html: svg }}
      />

      <p className="text-xs font-body text-muted break-all m-0">{adresa}</p>

      <div className="flex flex-wrap items-center justify-center gap-3 mt-auto pt-1">
        <a
          href={aplikace.cesta}
          className="text-sm font-heading font-semibold text-brand-purple hover:underline"
        >
          Otevřít v prohlížeči
        </a>
        <span className="w-px h-4 bg-line" aria-hidden="true" />
        <a
          href={`/instalace/qr?co=${aplikace.klic}`}
          className="text-sm font-heading font-semibold text-brand-purple hover:underline"
          download
        >
          Stáhnout QR jako obrázek
        </a>
      </div>
    </section>
  );
}

function Navod() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
      <section className="bg-surface rounded-card border border-line shadow-sm p-6">
        <h2 className="font-heading font-semibold text-lg text-ink m-0">iPhone a iPad</h2>
        <ol className="text-sm font-body text-muted mt-3 mb-0 pl-5 flex flex-col gap-2">
          <li>Kód načtěte fotoaparátem a stránku otevřete v Safari — v jiném prohlížeči to Apple nedovolí.</li>
          <li>Dole klepněte na ikonu sdílení (čtvereček se šipkou nahoru).</li>
          <li>Vyberte <strong className="text-ink">Přidat na plochu</strong> a potvrďte Přidat.</li>
        </ol>
        <p className="text-xs font-body text-muted mt-3 mb-0">
          Upozornění na nové zprávy chodí na iPhonu jenom aplikaci přidané na plochu. Zvoneček proto
          zapínejte až v nainstalovaném MS Chatu, ne v Safari.
        </p>
      </section>

      <section className="bg-surface rounded-card border border-line shadow-sm p-6">
        <h2 className="font-heading font-semibold text-lg text-ink m-0">Android</h2>
        <ol className="text-sm font-body text-muted mt-3 mb-0 pl-5 flex flex-col gap-2">
          <li>Kód načtěte fotoaparátem a stránku otevřete v Chromu.</li>
          <li>Vpravo nahoře klepněte na tři tečky.</li>
          <li>
            Vyberte <strong className="text-ink">Nainstalovat aplikaci</strong> (někdy se nabídne
            rovnou jako pruh dole).
          </li>
        </ol>
        <p className="text-xs font-body text-muted mt-3 mb-0">
          Obě aplikace jdou nainstalovat vedle sebe. Každá má vlastní ikonu i název, takže se na
          ploše nepopletou.
        </p>
      </section>
    </div>
  );
}
