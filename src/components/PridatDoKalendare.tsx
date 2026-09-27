/**
 * Tlačítka „Přidat do kalendáře" pro herce (zadání 19. 9. 2026).
 *
 * - Přidat do kalendáře: https odkaz na .ics - telefon/počítač nabídne
 *   přidání všech potvrzených termínů najednou.
 * - Odebírat: webcal:// odkaz - kalendář si termíny sám obnovuje, takže se
 *   v něm projeví i přesun nebo zrušení frekvence.
 * - Google Kalendář: ten .ics soubor neotevře, odběr se mu předává adresou.
 */
import { prelozit, type Jazyk } from '@/lib/jazyk';

// Tlačítka visí i na veřejné stránce termínů mimo JazykProvider, takže jazyk
// chodí propem (pravidlo 8 v docs/preklad-portalu.md).
export function PridatDoKalendare({ url, jazyk = 'cs' }: { url: string; jazyk?: Jazyk }) {
  const webcal = url.replace(/^https?:\/\//, 'webcal://');
  const google = `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 flex-wrap">
        <a
          href={url}
          className="bg-brand-purple text-white font-heading font-semibold text-sm rounded-lg px-4 py-2 no-underline hover:bg-brand-purpleDeep transition-colors"
        >
          {prelozit(jazyk, 'kalendarOdber.pridat')}
        </a>
        <a
          href={webcal}
          className="rounded-lg border border-brand-purple px-4 py-2 text-sm font-heading font-semibold text-brand-purple no-underline hover:bg-tint transition-colors"
        >
          {prelozit(jazyk, 'kalendarOdber.odebirat')}
        </a>
        <a
          href={google}
          target="_blank"
          rel="noreferrer"
          className="rounded-lg border border-line px-4 py-2 text-sm font-heading font-semibold text-ink no-underline hover:border-brand-purple transition-colors"
        >
          {prelozit(jazyk, 'kalendarOdber.google')}
        </a>
      </div>
      <p className="text-xs font-body text-muted m-0">
        {prelozit(jazyk, 'kalendarOdber.vysvetleni')}
      </p>
    </div>
  );
}
