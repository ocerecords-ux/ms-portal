'use client';

import { useEffect, useRef, useState } from 'react';

export type NakladovaPolozka = { nazev: string; castka: number };

const czk = (v: number) => `${Math.round(v).toLocaleString('cs-CZ')} Kč`;

/**
 * Položkové náklady projektu (zadání 11. 9. 2026: „do té karty mi dej třeba
 * položkové menu náklady, tak napíšu náklady na herce a tak dále").
 *
 * Ukládá se samo — stejně jako zbytek detailu projektu, kde tlačítko Uložit
 * od 11. 9. 2026 není („co přepneš, to tam je"). Zápis odchází se zpožděním,
 * aby se neposílal po každém písmenu.
 */
export function NakladyProjektu({
  caflouProjectId,
  pocatecni,
  onZmena,
}: {
  caflouProjectId: string;
  pocatecni: NakladovaPolozka[];
  /** Součet nahoru do rozpočtu, ať se čerpání přepočítá hned. */
  onZmena?: (soucet: number) => void;
}) {
  const [polozky, setPolozky] = useState<NakladovaPolozka[]>(pocatecni);
  const [stav, setStav] = useState<'nic' | 'uklada' | 'ulozeno' | 'chyba'>('nic');
  const prvniRef = useRef(true);

  const soucet = polozky.reduce((s, p) => s + (Number.isFinite(p.castka) ? p.castka : 0), 0);

  useEffect(() => {
    onZmena?.(soucet);
  }, [soucet, onZmena]);

  // Ulozeni se zpozdenim - jinak by odchazel zapis po kazdem pismenu.
  useEffect(() => {
    if (prvniRef.current) {
      prvniRef.current = false;
      return;
    }
    const cas = setTimeout(async () => {
      setStav('uklada');
      try {
        const res = await fetch(`/api/projekty/${encodeURIComponent(caflouProjectId)}/naklady`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ polozky: polozky.map((p) => ({ nazev: p.nazev, castka: Math.round(p.castka || 0) })) }),
        });
        setStav(res.ok ? 'ulozeno' : 'chyba');
      } catch {
        setStav('chyba');
      }
    }, 900);
    return () => clearTimeout(cas);
  }, [polozky, caflouProjectId]);

  function uprav(i: number, zmena: Partial<NakladovaPolozka>) {
    setPolozky((s) => s.map((p, j) => (j === i ? { ...p, ...zmena } : p)));
  }

  return (
    <div className="border-t border-line pt-4">
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <span className="text-xs font-heading text-muted uppercase tracking-wide">Náklady po položkách</span>
        <span className="text-xs font-heading text-muted">
          {stav === 'uklada' ? 'Ukládám…' : stav === 'ulozeno' ? '✓ Uloženo' : stav === 'chyba' ? 'Neuložilo se' : ''}
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        {polozky.map((p, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="text"
              value={p.nazev}
              onChange={(e) => uprav(i, { nazev: e.target.value })}
              placeholder="Honorář herce, studio, hudba…"
              className="flex-1 min-w-0 rounded-lg border border-line bg-field px-3 py-1.5 text-ink font-body text-sm outline-none focus:border-brand-purple"
            />
            <input
              type="number"
              value={Number.isFinite(p.castka) ? p.castka : ''}
              onChange={(e) => uprav(i, { castka: e.target.value === '' ? 0 : Number(e.target.value) })}
              placeholder="0"
              className="w-32 rounded-lg border border-line bg-field px-3 py-1.5 text-ink font-heading text-sm text-right tabular-nums outline-none focus:border-brand-purple"
            />
            <span className="text-xs font-heading text-muted w-6">Kč</span>
            <button
              type="button"
              onClick={() => setPolozky((s) => s.filter((_, j) => j !== i))}
              title="Smazat položku"
              className="text-muted hover:text-danger text-sm shrink-0 px-1"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3 mt-2">
        <button
          type="button"
          onClick={() => setPolozky((s) => [...s, { nazev: '', castka: 0 }])}
          className="text-xs font-heading font-semibold text-brand-purple hover:underline"
        >
          + Přidat položku
        </button>
        {polozky.length > 0 && (
          <span className="text-sm font-heading text-ink tabular-nums">
            Položky celkem <strong>{czk(soucet)}</strong>
          </span>
        )}
      </div>
      <p className="text-xs font-body text-muted mt-1.5 m-0">
        Bez DPH. Honoráře, studio, hudba — co portál sám neví.
      </p>
    </div>
  );
}
