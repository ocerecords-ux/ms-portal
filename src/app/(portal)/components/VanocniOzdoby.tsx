'use client';

import { useEffect } from 'react';

/**
 * VÁNOČNÍ MÓD - co zbylo mimo lištu (zadání 27. 11. 2026, dvakrát upřesněné:
 * „žádný Santa", „sněžení pryč", „pojďme to udělat namrzle, ten vrchní panel").
 *
 * SNÍH JE PRYČ. Padal přes celou stránku a při čtení tabulek pod ním to jen
 * rušilo. Celá výzdoba je teď na horní liště (components/Topbar.tsx) - ta
 * namrzne. Tahle komponenta už jen prohodí ikonu v záložce prohlížeče; nic
 * nekreslí a nic nepřekrývá.
 */
export function VanocniOzdoby() {
  useEffect(() => {
    const odkaz = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    const puvodni = odkaz?.getAttribute('href') ?? null;
    if (odkaz) odkaz.setAttribute('href', '/vanoce/favicon.svg');
    return () => {
      if (odkaz && puvodni) odkaz.setAttribute('href', puvodni);
    };
  }, []);

  return null;
}
