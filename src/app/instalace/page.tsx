import type { Metadata } from 'next';
import { APLIKACE, adresaAplikace, type Aplikace } from '@/lib/aplikace';
import { qrSvg } from '@/lib/qr';
import { nactiJazyk } from '@/lib/jazykServer';
import { prelozit, prelozitKolem, type Jazyk } from '@/lib/jazyk';

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
/**
 * Titulek a popis v hlavičce zůstávají ČESKY: Next.js je skládá mimo
 * požadavek, takže se k nim jazyk z cookie nedostane. Je to totéž rozhodnutí
 * jako u pošty - mimo rozhraní se nepřekládá.
 */
export const metadata: Metadata = {
  title: 'Nainstalovat do telefonu — MS Portal',
  description: 'Jak si přidat MS Portal a MS Chat na plochu telefonu.',
};

export const dynamic = 'force-dynamic';

export default async function InstalacePage() {
  const jazyk = nactiJazyk();
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
          <h1 className="font-display text-3xl sm:text-4xl text-ink m-0">
            {prelozit(jazyk, 'instalace.nadpis')}
          </h1>
          <p className="text-muted font-body m-0 mt-3 max-w-2xl">{prelozit(jazyk, 'instalace.uvod')}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {karty.map(({ aplikace, adresa, svg }) => (
            <KartaAplikace key={aplikace.klic} aplikace={aplikace} adresa={adresa} svg={svg} jazyk={jazyk} />
          ))}
        </div>

        <Navod jazyk={jazyk} />

        <p className="text-sm text-muted font-body m-0">{prelozit(jazyk, 'instalace.ucet')}</p>
      </div>
    </main>
  );
}

function KartaAplikace({
  aplikace,
  adresa,
  svg,
  jazyk,
}: {
  aplikace: Aplikace;
  adresa: string;
  svg: string;
  jazyk: Jazyk;
}) {
  return (
    <section className="bg-surface rounded-card border border-line shadow-sm p-6 flex flex-col items-center text-center gap-4">
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={aplikace.ikona} alt="" className="w-10 h-10 rounded-[10px]" />
        <h2 className="font-heading font-semibold text-xl text-ink m-0">{aplikace.nazev}</h2>
      </div>

      <p className="text-sm text-muted font-body m-0">{prelozit(jazyk, `aplikace.${aplikace.klic}.popis`)}</p>

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
          {prelozit(jazyk, 'instalace.otevritVProhlizeci')}
        </a>
        <span className="w-px h-4 bg-line" aria-hidden="true" />
        <a
          href={`/instalace/qr?co=${aplikace.klic}`}
          className="text-sm font-heading font-semibold text-brand-purple hover:underline"
          download
        >
          {prelozit(jazyk, 'instalace.stahnoutQr')}
        </a>
      </div>
    </section>
  );
}

function Navod({ jazyk }: { jazyk: Jazyk }) {
  /** Věta s tučným kusem - celá je jeden klíč (pravidlo 7). */
  const sTucnym = (klic: string, tucne: string) => {
    const [pred, za] = prelozitKolem(jazyk, klic, 'tucne');
    return (
      <>
        {pred}
        <strong className="text-ink">{tucne}</strong>
        {za}
      </>
    );
  };
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
      <section className="bg-surface rounded-card border border-line shadow-sm p-6">
        <h2 className="font-heading font-semibold text-lg text-ink m-0">{prelozit(jazyk, 'instalace.iphone')}</h2>
        <ol className="text-sm font-body text-muted mt-3 mb-0 pl-5 flex flex-col gap-2">
          <li>{prelozit(jazyk, 'instalace.iphoneKrok1')}</li>
          <li>{prelozit(jazyk, 'instalace.iphoneKrok2')}</li>
          <li>{sTucnym('instalace.iphoneKrok3', prelozit(jazyk, 'instalace.iphonePridatNaPlochu'))}</li>
        </ol>
        <p className="text-xs font-body text-muted mt-3 mb-0">{prelozit(jazyk, 'instalace.iphonePozn')}</p>
      </section>

      <section className="bg-surface rounded-card border border-line shadow-sm p-6">
        <h2 className="font-heading font-semibold text-lg text-ink m-0">{prelozit(jazyk, 'instalace.android')}</h2>
        <ol className="text-sm font-body text-muted mt-3 mb-0 pl-5 flex flex-col gap-2">
          <li>{prelozit(jazyk, 'instalace.androidKrok1')}</li>
          <li>{prelozit(jazyk, 'instalace.androidKrok2')}</li>
          <li>{sTucnym('instalace.androidKrok3', prelozit(jazyk, 'instalace.androidNainstalovat'))}</li>
        </ol>
        <p className="text-xs font-body text-muted mt-3 mb-0">{prelozit(jazyk, 'instalace.androidPozn')}</p>
      </section>
    </div>
  );
}
