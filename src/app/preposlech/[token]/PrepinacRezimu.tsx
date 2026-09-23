'use client';

import { useEffect, useState } from 'react';
import { RezimNevidomi } from './RezimNevidomi';

/**
 * Přepínač mezi běžným přeposlechem a režimem pro nevidomé (zadání
 * 23. 9. 2026: „přepla by se tlačítkem"). Volba se pamatuje v prohlížeči,
 * takže kdo režim jednou zapne, otevře si příště odkaz rovnou v něm.
 *
 * Vidoucímu klientovi tlačítko do oka nepadne (zadání 23. 9. 2026: „to
 * tlačítko pro nevidomé někde schovej, ať není nápadné"): nahoře je schované
 * a vyskočí, až když se na něj někdo dostane tabulátorem - čili přesně tomu,
 * kdo ho potřebuje, protože čtečka po něm šlape jako první. Vespod stránky
 * je pak ještě tichý odkaz drobným písmem.
 */
const KLIC = 'ms-preposlech-nevidomi';

export function PrepinacRezimu({
  caflouProjectId,
  projectName,
  token,
  children,
}: {
  caflouProjectId: string;
  projectName: string;
  token: string;
  /** Běžný AudioTagger - vykreslí se, dokud je režim vypnutý. */
  children: React.ReactNode;
}) {
  const [nevidomi, setNevidomi] = useState(false);
  const [nacteno, setNacteno] = useState(false);

  useEffect(() => {
    try {
      setNevidomi(window.localStorage.getItem(KLIC) === '1');
    } catch {
      // Zakázané úložiště režim jen nezapamatuje.
    }
    setNacteno(true);
  }, []);

  function prepni(zapnout: boolean) {
    setNevidomi(zapnout);
    try {
      window.localStorage.setItem(KLIC, zapnout ? '1' : '0');
    } catch {
      // Nevadí - platí to aspoň pro tohle otevření.
    }
  }

  if (nevidomi) {
    return (
      <RezimNevidomi
        caflouProjectId={caflouProjectId}
        projectName={projectName}
        token={token}
        onZpet={() => prepni(false)}
      />
    );
  }

  return (
    <>
      {/* Schované tlačítko: čtečka i tabulátor na něj narazí jako na první
          věc na stránce, okem ho nikdo nenajde. */}
      <button
        type="button"
        onClick={() => prepni(true)}
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:border focus:border-line focus:bg-surface focus:px-3 focus:py-2 focus:text-sm focus:font-heading focus:font-semibold focus:text-ink focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-purple"
      >
        Přepnout do režimu pro nevidomé
      </button>

      {/* Dokud nevíme, co je uložené, obsah se vykreslí normálně - stránka
          tak nebliká a čtečka má co číst hned. */}
      <div aria-busy={!nacteno ? undefined : undefined}>{children}</div>

      {/* Tichý odkaz na konci stránky - kdyby ho někdo hledal očima. */}
      <p className="mt-8 text-center">
        <button
          type="button"
          onClick={() => prepni(true)}
          className="text-[11px] font-body text-muted/60 underline underline-offset-2 hover:text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple"
        >
          Režim pro nevidomé
        </button>
      </p>
    </>
  );
}
