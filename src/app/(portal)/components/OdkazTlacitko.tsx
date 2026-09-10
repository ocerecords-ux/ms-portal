'use client';

import { useEffect, useState } from 'react';

/**
 * Odkaz jako tlačítko, vedle něj zkopírování adresy (zadání 10. 9. 2026:
 * "u projektů ty odkazy, kde jsou linky, změň na tlačítko a u toho možnost
 * zkopírovat odkaz").
 *
 * Adresa složky na Disku je nechutně dlouhá a jako podtržený text se špatně
 * trefuje. Tlačítko je terč, do kterého se dá kliknout, a druhé tlačítko
 * zkopíruje adresu - typicky když se posílá někomu do zprávy.
 */
export function OdkazTlacitko({
  url,
  popisek,
  varianta = 'hlavni',
}: {
  url: string | null | undefined;
  popisek: string;
  /** "hlavni" = plné tlačítko, "vedlejsi" = jen orámované, do řádku k jiným. */
  varianta?: 'hlavni' | 'vedlejsi';
}) {
  const [zkopirovano, setZkopirovano] = useState(false);

  // Potvrzení "Zkopírováno" po chvíli zmizí samo. Bez úklidu časovače by
  // se stav nastavoval i po odstranění komponenty.
  useEffect(() => {
    if (!zkopirovano) return;
    const id = window.setTimeout(() => setZkopirovano(false), 2000);
    return () => window.clearTimeout(id);
  }, [zkopirovano]);

  if (!url) return <span className="text-sm font-heading text-muted">—</span>;

  async function zkopiruj() {
    try {
      await navigator.clipboard.writeText(url as string);
      setZkopirovano(true);
    } catch {
      // Prohlížeč bez schránky (starší, nebo bez https) - ať to aspoň
      // neselže tiše a člověk si adresu označí sám.
      window.prompt('Zkopírujte odkaz:', url as string);
    }
  }

  const tridaOdkazu =
    varianta === 'hlavni'
      ? 'bg-brand-purple text-white hover:bg-brand-purpleDeep'
      : 'border border-line text-brand-purple hover:bg-tint';

  return (
    <span className="inline-flex items-center gap-2">
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className={`inline-flex items-center gap-1.5 font-heading font-semibold text-sm rounded-lg px-3.5 py-2 no-underline transition-colors ${tridaOdkazu}`}
      >
        {popisek}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
          <path d="M14 4h6v6M20 4l-8 8" />
          <path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
        </svg>
      </a>
      <button
        type="button"
        onClick={() => void zkopiruj()}
        title="Zkopírovat odkaz"
        aria-label="Zkopírovat odkaz"
        className="inline-flex items-center gap-1.5 font-heading font-semibold text-xs rounded-lg border border-line px-2.5 py-2 text-muted hover:text-ink transition-colors"
      >
        {zkopirovano ? (
          <>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 text-status-done">
              <path d="M4 12.5l5 5L20 6.5" />
            </svg>
            Zkopírováno
          </>
        ) : (
          <>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
              <rect x="9" y="9" width="11" height="11" rx="2" />
              <path d="M5 15V5a2 2 0 0 1 2-2h8" />
            </svg>
            Kopírovat
          </>
        )}
      </button>
    </span>
  );
}
