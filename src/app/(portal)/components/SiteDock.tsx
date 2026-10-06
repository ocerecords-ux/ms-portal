'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { usePreklad } from './JazykProvider';
import type { DokSiti } from '@/lib/pribehyServer';

/**
 * VYSKAKOVACÍ ZÁLOŽKA SÍTĚ (zadání 6. 10. 2026: „chci udělat vyskakovací
 * záložku, kde budou soc. sítě, nalevo v portálu pod rychlýma volbama").
 *
 * Chová se jako rychlé volby o kus výš: zatažená je úzké fialové poutko se
 * zelenou ikonou, po kliknutí vyjede panel. Otevřený stav si pamatuje
 * prohlížeč, takže se při přechodu na jinou stránku nezavírá.
 *
 * KDE PŘESNĚ SEDÍ, SE MĚŘÍ, NEPOČÍTÁ. Rychlé volby jsou vysoké podle toho,
 * kolik si jich člověk nastavil, a rozbalené jsou vysoké úplně jinak - číslo
 * natvrdo by se dřív nebo později rozešlo. Záložka si proto najde panel nad
 * sebou (`data-quick-dock`) a posadí se pod něj.
 *
 * ČEKAJÍCÍ PŘÍBĚHY JSOU VIDĚT ROVNOU. Odznak s počtem na poutku a malé
 * náhledy v panelu - kvůli tomu to celé je: aby se na frontu dalo kouknout
 * z kterékoli stránky, ne až po proklikání do Sítí.
 */

const STORAGE_KEY = 'ms-site-dock';
/** Když se panel rychlých voleb nenajde, sedne si záložka sem. */
const ZALOHA_SHORA = 420;

function IkonaSiti() {
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

function Chevron({ smer }: { smer: 'left' | 'right' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
    >
      <path d={smer === 'right' ? 'M9 6l6 6-6 6' : 'M15 6l-6 6 6 6'} />
    </svg>
  );
}

export function SiteDock({ dok }: { dok: DokSiti }) {
  const t = usePreklad();
  const [otevreno, setOtevreno] = useState(false);
  const [shora, setShora] = useState(ZALOHA_SHORA);
  const panel = useRef<HTMLElement | null>(null);

  useEffect(() => {
    try {
      setOtevreno(window.localStorage.getItem(STORAGE_KEY) === '1');
    } catch {
      // Prohlizec bez localStorage - zalozka proste zacne zatazena.
    }
  }, []);

  /** Posadí se pod rychlé volby a hlídá, když změní výšku. */
  useEffect(() => {
    const zmer = () => {
      const nad = document.querySelector('[data-quick-dock]');
      if (!nad) {
        setShora(ZALOHA_SHORA);
        return;
      }
      setShora(nad.getBoundingClientRect().bottom + 10);
    };
    zmer();
    const nad = document.querySelector('[data-quick-dock]');
    const hlidac =
      nad && typeof ResizeObserver !== 'undefined' ? new ResizeObserver(zmer) : null;
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
  }, [otevreno]);

  function prepni() {
    setOtevreno((stav) => {
      const dalsi = !stav;
      try {
        window.localStorage.setItem(STORAGE_KEY, dalsi ? '1' : '0');
      } catch {
        // Neulozeny stav zalozky nikomu nevadi.
      }
      return dalsi;
    });
  }

  const pocet = dok.cekajici.length;
  const popisPoctu = dok.vicNez ? `${pocet}+` : String(pocet);

  // --- Zatazeno: poutko se zelenou ikonou --------------------------------
  if (!otevreno) {
    return (
      <aside
        ref={panel}
        style={{ top: shora }}
        className="fixed left-0 z-40 flex flex-col items-stretch overflow-hidden rounded-r-card bg-brand-purple shadow-lg"
      >
        <button
          type="button"
          onClick={prepni}
          title={t('dokSiti.nadpis')}
          aria-label={t('dokSiti.nadpis')}
          className="relative flex items-center justify-center px-2.5 py-2.5 text-brand-green transition-colors hover:bg-brand-purpleDeep"
        >
          <IkonaSiti />
          {pocet > 0 && (
            <span className="absolute right-0.5 top-0.5 grid min-w-[16px] place-items-center rounded-pill bg-brand-green px-1 font-heading text-[10px] font-semibold leading-4 text-onAccent">
              {popisPoctu}
            </span>
          )}
        </button>
        <span className="border-t border-white/15">
          <button
            type="button"
            onClick={prepni}
            title={t('dokSiti.zobrazit')}
            aria-label={t('dokSiti.zobrazit')}
            className="flex w-full items-center justify-center px-2.5 py-2 text-brand-green transition-colors hover:bg-brand-purpleDeep"
          >
            <Chevron smer="right" />
          </button>
        </span>
      </aside>
    );
  }

  // --- Rozbaleno ---------------------------------------------------------
  return (
    <aside ref={panel} style={{ top: shora }} className="fixed left-0 z-40 flex items-stretch">
      <div className="flex w-60 max-w-[70vw] flex-col rounded-r-card border border-l-0 border-line bg-surface shadow-lg">
        <div className="flex items-center justify-between gap-2 rounded-tr-card bg-brand-purple px-3 py-2.5 text-white">
          <span className="font-heading text-xs font-semibold uppercase tracking-wide">
            {t('dokSiti.nadpis')}
          </span>
          <button
            type="button"
            onClick={prepni}
            title={t('dokSiti.skryt')}
            aria-label={t('dokSiti.skryt')}
            className="text-white/80 transition-colors hover:text-white"
          >
            <Chevron smer="left" />
          </button>
        </div>

        <div className="flex flex-col gap-2 p-3">
          {dok.smiPoslat && (
            <Link
              href="/site/pribehy"
              className="flex items-center justify-center rounded-pill bg-brand-purple px-3 py-2 font-heading text-sm font-semibold text-white no-underline transition-colors hover:bg-brand-purpleDeep"
            >
              {t('dokSiti.novyPribeh')}
            </Link>
          )}

          <Link
            href="/site/pribehy"
            className="flex items-center justify-between gap-2 rounded-card border border-line px-3 py-2 font-heading text-sm text-ink no-underline transition-colors hover:border-brand-purple"
          >
            <span className="truncate">{t('dokSiti.fronta')}</span>
            <span
              className={`grid min-w-[22px] place-items-center rounded-pill px-1.5 font-heading text-xs font-semibold tabular-nums ${
                pocet > 0 ? 'bg-brand-green text-onAccent' : 'bg-field text-muted'
              }`}
            >
              {popisPoctu}
            </span>
          </Link>

          {pocet > 0 && (
            <div className="grid grid-cols-3 gap-1.5">
              {dok.cekajici.slice(0, 3).map((p) => (
                <Link
                  key={p.id}
                  href="/site/pribehy"
                  aria-label={t('dokSiti.fronta')}
                  className="block overflow-hidden rounded-lg border border-line bg-bar no-underline"
                >
                  <span className="relative block aspect-[9/16]">
                    {p.jeVideo ? (
                      <video
                        src={`/api/site/pribehy/${p.id}/soubor`}
                        preload="metadata"
                        muted
                        playsInline
                        className="pointer-events-none h-full w-full object-cover"
                      />
                    ) : (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={`/api/site/pribehy/${p.id}/soubor`}
                        alt=""
                        className="pointer-events-none h-full w-full object-cover"
                      />
                    )}
                  </span>
                </Link>
              ))}
            </div>
          )}

          {dok.smiPrispevky && (
            <Link
              href="/site"
              className="rounded-card border border-line px-3 py-2 font-heading text-sm text-ink no-underline transition-colors hover:border-brand-purple"
            >
              {t('dokSiti.prispevky')}
            </Link>
          )}

          <p className="m-0 font-body text-[11px] text-muted">{t('dokSiti.popis')}</p>
        </div>
      </div>
    </aside>
  );
}
