'use client';

import { useEffect, useState } from 'react';

/**
 * OKNO S PŘEHLEDEM DNE (zadání 23. 9. 2026: „ať se mi v portálu otevře
 * průhledné vyskakovací okno a tam to bude").
 *
 * Otevře se samo, jednou za den, po prvním otevření portálu po sedmé ráno -
 * komu je přehled zapnutý v Můj účet. Co v něm je, skládá server (tentýž
 * text, jakým Bruno odpovídá na „co mám dneska") - viz /api/prehled-dne.
 *
 * PRŮHLEDNÉ, NE ŠEDIVÉ. Pozadí zůstává vidět a rozostřené: je to zpráva na
 * dobré ráno, ne modální dialog, který něco blokuje. Zavře ho křížek,
 * Escape i klik mimo - a do dalšího rána se neukáže.
 */
export function PrehledDne() {
  const [text, setText] = useState<string | null>(null);
  const [zavirame, setZavirame] = useState(false);

  useEffect(() => {
    let platne = true;
    // Po načtení stránky - ať se dotaz nepere s vykreslením portálu.
    const casovac = setTimeout(() => {
      fetch('/api/prehled-dne')
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (platne && d?.ukazat && typeof d.text === 'string') setText(d.text);
        })
        .catch(() => undefined);
    }, 1200);
    return () => {
      platne = false;
      clearTimeout(casovac);
    };
  }, []);

  useEffect(() => {
    if (!text) return;
    const naKlavesu = (e: KeyboardEvent) => {
      if (e.key === 'Escape') zavri();
    };
    window.addEventListener('keydown', naKlavesu);
    return () => window.removeEventListener('keydown', naKlavesu);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  function zavri() {
    if (zavirame) return;
    setZavirame(true);
    setText(null);
    // Poznámka na server, ať se dneska neotevře znovu. Když se to nepovede,
    // nic se neděje - nanejvýš okno vyskočí na jiné záložce ještě jednou.
    fetch('/api/prehled-dne', { method: 'POST' }).catch(() => undefined);
  }

  if (!text) return null;

  const radky = text.split('\n');
  const nadpis = radky[0] ?? '';
  const zbytek = radky.slice(1);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-start sm:items-center justify-center p-4 sm:p-6 bg-black/25 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Přehled dne"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) zavri();
      }}
    >
      <div className="w-full max-w-[520px] my-auto rounded-card border border-line bg-surface/85 backdrop-blur-md shadow-lg p-5 sm:p-6 flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4">
          <h2 className="font-display text-2xl text-ink m-0">{nadpis}</h2>
          <button
            type="button"
            onClick={zavri}
            aria-label="Zavřít"
            className="text-muted hover:text-ink text-xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="flex flex-col gap-1.5">
          {zbytek.map((r, i) =>
            r.trim() === '' ? (
              <span key={i} className="h-2" />
            ) : r.startsWith('•') ? (
              <p key={i} className="text-sm font-body text-ink m-0 pl-1">
                {r}
              </p>
            ) : (
              <p key={i} className="text-xs font-heading uppercase tracking-wide text-muted m-0 mt-1">
                {r}
              </p>
            ),
          )}
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={zavri}
            className="rounded-pill bg-brand-purple text-white font-heading text-sm px-4 py-2"
          >
            Díky, mám to
          </button>
        </div>
      </div>
    </div>
  );
}
