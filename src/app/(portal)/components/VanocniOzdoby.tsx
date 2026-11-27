'use client';

import { useEffect, useMemo } from 'react';

/**
 * VÁNOČNÍ VÝZDOBA PORTÁLU (zadání 27. 11. 2026). Sníh přes stránku a vánoční
 * ikona v záložce prohlížeče. Světýlka visí z lišty (components/Topbar.tsx) -
 * odsud by se schovala pod ni, protože lišta je o vrstvu výš.
 *
 * PRAVIDLA, ABY TO NEPŘEKÁŽELO:
 *   - `pointer-events: none` - na sníh se nedá kliknout a nic pod ním
 *     nepřestane fungovat,
 *   - vrstva z-40, tedy POD lištou a pod vyskakovacími okny (z-50): sníh má
 *     padat za portálem, ne přes dialog, který zrovna někdo čte,
 *   - `prefers-reduced-motion` vločky zastaví - komu se z pohybu dělá
 *     nevolno, ten uvidí tiché světýlka a nic víc,
 *   - vločky jsou obyčejné divy s CSS animací, žádné plátno ani knihovna:
 *     pár desítek prvků prohlížeč utáhne a nic se nepřekresluje v JS.
 *
 * Zapnutí řeší server (lib/vanoceServer.ts) - sem se komponenta vůbec
 * nedostane, když má být zhasnuto.
 */

/** Kolik vloček padá. Víc už je chumelenice, přes kterou není vidět text. */
const POCET_VLOCEK = 34;

export function VanocniOzdoby() {
  /**
   * Vločky se rozmístí jednou a pak se nemění - kdyby se počítaly při každém
   * překreslení, sníh by poskakoval pokaždé, když se v portálu cokoliv změní.
   */
  const vlocky = useMemo(
    () =>
      Array.from({ length: POCET_VLOCEK }, (_, i) => ({
        id: i,
        vlevo: Math.random() * 100,
        velikost: 6 + Math.random() * 10,
        trvani: 9 + Math.random() * 11,
        zpozdeni: -Math.random() * 20,
        sila: 0.35 + Math.random() * 0.45,
        posun: Math.round(-40 + Math.random() * 80),
      })),
    [],
  );

  /** Ikona v záložce prohlížeče. Při odchodu se vrátí ta původní. */
  useEffect(() => {
    const odkaz = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    const puvodni = odkaz?.getAttribute('href') ?? null;
    if (odkaz) odkaz.setAttribute('href', '/vanoce/favicon.svg');
    return () => {
      if (odkaz && puvodni) odkaz.setAttribute('href', puvodni);
    };
  }, []);

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-40 overflow-hidden">
      <style>{`
        @keyframes ms-snih {
          0%   { transform: translate3d(0, -10vh, 0); }
          100% { transform: translate3d(var(--ms-posun, 0px), 110vh, 0); }
        }
        .ms-vlocka {
          position: absolute;
          top: -10vh;
          border-radius: 9999px;
          background: #ffffff;
          filter: blur(0.3px);
          animation-name: ms-snih;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .ms-vlocka { display: none; }
        }
      `}</style>

      {vlocky.map((v) => (
        <span
          key={v.id}
          className="ms-vlocka"
          style={{
            left: `${v.vlevo}%`,
            width: v.velikost,
            height: v.velikost,
            opacity: v.sila,
            animationDuration: `${v.trvani}s`,
            animationDelay: `${v.zpozdeni}s`,
            ['--ms-posun' as string]: `${v.posun}px`,
          }}
        />
      ))}
    </div>
  );
}
