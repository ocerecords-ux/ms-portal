'use client';

import { useEffect, useState } from 'react';
import { RezimNevidomi } from './RezimNevidomi';

/**
 * Přepínač mezi běžným přeposlechem a režimem pro nevidomé (zadání
 * 23. 9. 2026: „přepla by se tlačítkem"). Volba se pamatuje v prohlížeči,
 * takže kdo režim jednou zapne, otevře si příště odkaz rovnou v něm.
 *
 * Tlačítko je první věc na stránce, aby na ni čtečka narazila dřív než na
 * cokoliv jiného.
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
      <div className="mb-3 flex justify-end">
        <button
          type="button"
          onClick={() => prepni(true)}
          className="rounded-lg border border-line bg-surface px-3 py-2 text-sm font-heading font-semibold text-ink hover:border-brand-purple focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-purple"
        >
          Režim pro nevidomé
        </button>
      </div>
      {/* Dokud nevíme, co je uložené, obsah se vykreslí normálně - stránka
          tak nebliká a čtečka má co číst hned. */}
      <div aria-busy={!nacteno ? undefined : undefined}>{children}</div>
    </>
  );
}
