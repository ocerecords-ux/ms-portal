'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePreklad } from './JazykProvider';
import type { DokSiti } from '@/lib/pribehyServer';

/**
 * SÍTĚ V LEVÉM PANELU (zadání 6. 10. 2026: „chci udělat vyskakovací záložku,
 * kde budou soc. sítě, nalevo v portálu pod rychlýma volbama", upřesněno týž
 * den: „a tady žádné rozbalování. Po kliknutí na ikonu instagramu bych se
 * chtěl dostat rovnou na příběhy a pak pod to ještě jednu ikonu a tou se
 * dostanu na příspěvky na sítě").
 *
 * ŽÁDNÝ PANEL, JEN DVĚ IKONY. První vede rovnou na Příběhy, druhá na
 * Příspěvky na sítě; druhou vidí jen ten, kdo na příspěvky má právo (zatím
 * se modul dodělává, takže je to Ondřej). Rozbalovací panel tu byl chvíli
 * a vadil - do fronty se stejně klikalo dál.
 *
 * NA PRVNÍ IKONĚ SVÍTÍ POČET ROZDĚLANÝCH - koncepty a to, co Instagram
 * nevzal. Kvůli tomu to celé je: aby bylo z kterékoli stránky vidět, že
 * něco visí.
 *
 * KDE SEDÍ, SE MĚŘÍ, NEPOČÍTÁ. Rychlé volby nad tím jsou vysoké podle toho,
 * kolik si jich kdo nastavil, a rozbalené jsou vysoké jinak - číslo natvrdo
 * by se dřív nebo později rozešlo.
 */

/** Když se panel rychlých voleb nenajde, sedne si záložka sem. */
const ZALOHA_SHORA = 420;

function IkonaPribehu() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5 shrink-0"
    >
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Plátno s obrázkem - příspěvky se skládají jako v Canvě. */
function IkonaPrispevku() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5 shrink-0"
    >
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <circle cx="8.5" cy="9.5" r="1.6" />
      <path d="M4 17l4.5-4.5 3 3L15 12l5 5" />
    </svg>
  );
}

export function SiteDock({ dok }: { dok: DokSiti }) {
  const t = usePreklad();
  const [shora, setShora] = useState(ZALOHA_SHORA);

  /** Posadí se pod rychlé volby a hlídá, když změní výšku. */
  useEffect(() => {
    const zmer = () => {
      const nad = document.querySelector('[data-quick-dock]');
      setShora(nad ? nad.getBoundingClientRect().bottom + 10 : ZALOHA_SHORA);
    };
    zmer();
    const nad = document.querySelector('[data-quick-dock]');
    const hlidac = nad && typeof ResizeObserver !== 'undefined' ? new ResizeObserver(zmer) : null;
    if (nad && hlidac) hlidac.observe(nad);
    window.addEventListener('resize', zmer);
    // Rychle volby se rozbaluji tridou na <body> - tim se meni i jejich vyska.
    const telo = typeof MutationObserver !== 'undefined' ? new MutationObserver(zmer) : null;
    telo?.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    return () => {
      hlidac?.disconnect();
      telo?.disconnect();
      window.removeEventListener('resize', zmer);
    };
  }, []);

  const pocet = dok.cekajici.length;
  const popisPoctu = dok.vicNez ? `${pocet}+` : String(pocet);

  return (
    <aside
      style={{ top: shora }}
      className="fixed left-0 z-40 flex flex-col items-stretch overflow-hidden rounded-r-card bg-brand-purple shadow-lg"
    >
      <Link
        href="/site/pribehy"
        title={t('dokSiti.pribehy')}
        aria-label={t('dokSiti.pribehy')}
        className="relative flex items-center justify-center px-2.5 py-2.5 text-brand-green no-underline transition-colors hover:bg-brand-purpleDeep"
      >
        <IkonaPribehu />
        {pocet > 0 && (
          <span className="absolute right-0.5 top-0.5 grid min-w-[16px] place-items-center rounded-pill bg-brand-green px-1 font-heading text-[10px] font-semibold leading-4 text-onAccent">
            {popisPoctu}
          </span>
        )}
      </Link>

      {dok.smiPrispevky && (
        <Link
          href="/site"
          title={t('dokSiti.prispevky')}
          aria-label={t('dokSiti.prispevky')}
          className="flex items-center justify-center border-t border-white/15 px-2.5 py-2.5 text-brand-green no-underline transition-colors hover:bg-brand-purpleDeep"
        >
          <IkonaPrispevku />
        </Link>
      )}
    </aside>
  );
}
