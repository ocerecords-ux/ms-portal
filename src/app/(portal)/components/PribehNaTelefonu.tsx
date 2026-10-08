'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { usePreklad } from './JazykProvider';

/**
 * PŘÍBĚH NA INSTAGRAM Z TELEFONU (zadání 6. 10. 2026: „MS portal aplikaci
 * bych dal jedno tlačítko na instagram příběh, tu ikonu napravo nahoru do
 * toho černého místa").
 *
 * PROČ VŮBEC. Na počítači se na příběhy chodí záložkou Sítě u levé hrany,
 * jenže doky jsou na telefonu schované (`hidden md:block` v layoutu) - a
 * příběh se fotí právě telefonem. Bez tohohle tlačítka by se k příběhům
 * z mobilu šlo dostat jen přes nabídku.
 *
 * KDE SEDÍ. V tmavém pruhu hned pod lištou, u pravé hrany - tam, kde je
 * na každé stránce místo (nalevo bývá ozubené kolo, které se na telefonu
 * nevykresluje vůbec). Výška lišty se MĚŘÍ, nepočítá: na telefonu se láme
 * na dva řádky a kdo si do ní přidá další odkazy, posune ji níž.
 *
 * JEN NA TELEFONU (`md:hidden`) - schválně stejná hranice, za kterou se
 * schovávají doky, aby ikona nebyla na počítači dvakrát.
 *
 * A JEN NA ÚVODNÍ STRÁNCE (zadání 8. 10. 2026: „ta ikona na insta by neměla
 * být vidět nikde jinde než na úvodní stránce“). Na každé stránce překrývala
 * obsah - na Příbězích dokonce vlastní nadpis. Úvodní stránka portálu je
 * seznam projektů, tedy `/projekty` (viz přesměrování v src/app/page.tsx);
 * detail projektu už úvodní stránka není.
 */
const UVODNI_STRANKA = '/projekty';

/**
 * Když se lišta nenajde, tlačítko si sedne sem. Číslo odpovídá liště
 * zalomené na dva řádky, jak vypadá na telefonu - nižší záloha by
 * tlačítko při prvním vykreslení položila do lišty.
 */
const ZALOHA_SHORA = 180;

/** Instagram - stejná kresba jako v záložce Sítě u levé hrany. */
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

export function PribehNaTelefonu({ pocet, vicNez }: { pocet: number; vicNez: boolean }) {
  const t = usePreklad();
  const kdeJsem = usePathname();
  const [shora, setShora] = useState(ZALOHA_SHORA);

  /** Posadí se pod lištu a hlídá, když lišta změní výšku. */
  useEffect(() => {
    const lista = document.querySelector('[data-lista]');
    const zmer = () => setShora(lista ? lista.getBoundingClientRect().height + 8 : ZALOHA_SHORA);
    zmer();
    const hlidac = lista && typeof ResizeObserver !== 'undefined' ? new ResizeObserver(zmer) : null;
    if (lista && hlidac) hlidac.observe(lista);
    window.addEventListener('resize', zmer);
    return () => {
      hlidac?.disconnect();
      window.removeEventListener('resize', zmer);
    };
  }, []);

  // Hooky musí běžet vždycky, takže se stránka kontroluje až tady.
  if (kdeJsem !== UVODNI_STRANKA) return null;

  const popisPoctu = vicNez ? `${pocet}+` : String(pocet);

  return (
    <Link
      href="/site/pribehy?nova=1"
      style={{ top: shora }}
      title={t('dokSiti.pribehy')}
      aria-label={t('dokSiti.pribehy')}
      className="md:hidden fixed right-3 z-30 grid h-10 w-10 place-items-center rounded-pill bg-brand-purple text-brand-green no-underline shadow-lg transition-colors hover:bg-brand-purpleDeep"
    >
      <IkonaPribehu />
      {pocet > 0 && (
        <span className="absolute -right-1 -top-1 grid min-w-[18px] place-items-center rounded-pill bg-brand-green px-1 font-heading text-[10px] font-semibold leading-[18px] text-onAccent">
          {popisPoctu}
        </span>
      )}
    </Link>
  );
}
