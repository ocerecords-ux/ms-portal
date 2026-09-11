'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Živý náhled dokladu vedle formuláře (zadání 10. 9. 2026: „vlevo tabulka na
 * vyplnění údajů a napravo rovnou náhled PDF v grafické podobě").
 *
 * Funguje stejně jako náhled Rodného listu: rozepsané hodnoty se s malým
 * zpožděním pošlou na server, ten z nich vyrobí PDF a to se ukáže v rámu.
 * NIC SE NEUKLÁDÁ - doklad, který se teprve zakládá, ani nemá kam.
 *
 * Rám má poměr stran A4 a otevírá se přes #view=Fit, takže je vidět celá
 * stránka, ne jen její horní část.
 */
export function NahledDokladu({
  telo,
  titulek = 'Náhled',
}: {
  /** Co se má vysázet. Komponenta si hlídá, že se to opravdu změnilo. */
  telo: unknown;
  titulek?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [dela, setDela] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);
  const posledniUrl = useRef<string | null>(null);

  const otisk = JSON.stringify(telo);

  useEffect(() => {
    // Půl vteřiny ticha - jinak by se překreslovalo po každém písmenu.
    const casovac = setTimeout(async () => {
      const rizeni = new AbortController();
      setDela(true);
      try {
        const res = await fetch('/api/doklady/nahled', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: otisk,
          signal: rizeni.signal,
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setChyba(data?.error || 'Náhled se nepodařilo vyrobit.');
          return;
        }
        setChyba(null);
        const blob = await res.blob();
        const novy = URL.createObjectURL(blob);
        // Předchozí PDF pustíme z paměti - bez toho by se při psaní hromadila
        // jedna kopie dokumentu za druhou.
        if (posledniUrl.current) URL.revokeObjectURL(posledniUrl.current);
        posledniUrl.current = novy;
        setUrl(novy);
      } catch {
        // Přerušený požadavek při dalším ťuknutí není chyba.
      } finally {
        setDela(false);
      }
    }, 500);

    return () => clearTimeout(casovac);
  }, [otisk]);

  useEffect(() => {
    return () => {
      if (posledniUrl.current) URL.revokeObjectURL(posledniUrl.current);
    };
  }, []);

  return (
    <div className="bg-surface rounded-card border border-line shadow-sm overflow-hidden lg:sticky lg:top-24 self-start">
      <div className="flex items-center justify-between flex-wrap gap-3 px-5 py-3.5 border-b border-line">
        <div>
          <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">{titulek}</h2>
          <p className="text-xs font-body text-muted m-0 mt-1">
            {dela ? 'Překresluji…' : 'Mění se s tím, co píšete. Nikam se neukládá.'}
          </p>
        </div>
      </div>

      <div className="bg-field px-4 py-5 sm:px-6 sm:py-6">
        {chyba ? (
          <p className="text-sm font-body text-danger m-0 text-center py-10">{chyba}</p>
        ) : (
          <iframe
            // Zdroj je PDF vyrobene z rozepsanych hodnot a drzene v pameti
            // prohlizece - proto blob:, ne adresa routy.
            src={url ? `${url}#view=Fit&toolbar=0&navpanes=0` : undefined}
            title={titulek}
            className={`w-full aspect-[210/297] rounded-lg border border-line bg-white shadow-md transition-opacity ${
              dela ? 'opacity-60' : 'opacity-100'
            }`}
          />
        )}
      </div>
    </div>
  );
}
