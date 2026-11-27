'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * VÁNOČNÍ VÝZDOBA (zadání 27. 11. 2026: „pojďme navrhnout vánoční mód
 * portálu" → dekorace, zapíná se sama od 1. 12. do 1. 1. a jde vypnout).
 *
 * Dva vypínače v jedné kartě: svůj má každý, ten pro celý portál vidí jen
 * Žůžo-labůžo. Ukládá se hned, bez tlačítka - jako u ostatních přepínačů
 * v Mém účtu.
 *
 * Texty jsou psané tady a ne přes lib/jazyk.ts: v tom souboru běží
 * překladová dávka a dvě ruce v jednom souboru končí přepsanou prací.
 */
const REZIMY = [
  { klic: 'auto' as const, nazev: 'Podle data', popis: 'Svítí od 1. prosince do 1. ledna.' },
  { klic: 'vzdy' as const, nazev: 'Svítit pořád', popis: 'I mimo sezónu - na vyzkoušení.' },
  { klic: 'nikdy' as const, nazev: 'Zhasnout', popis: 'Nikdo z portálu výzdobu neuvidí.' },
];

export function VanoceKarta({
  uMe,
  rezim,
  jsemSpravce,
  bezi,
}: {
  /** Chci výzdobu u sebe? */
  uMe: boolean;
  /** Režim celého portálu. */
  rezim: 'auto' | 'vzdy' | 'nikdy';
  jsemSpravce: boolean;
  /** Je prosinec? Mimo sezónu se jen řekne, že se to rozsvítí samo. */
  bezi: boolean;
}) {
  const router = useRouter();
  const [mne, setMne] = useState(uMe);
  const [portal, setPortal] = useState(rezim);
  const [uklada, setUklada] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);

  async function uloz(telo: { uMe?: boolean; rezim?: 'auto' | 'vzdy' | 'nikdy' }) {
    setUklada(true);
    setChyba(null);
    try {
      const res = await fetch('/api/me/vanoce', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(telo),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setChyba(data?.error || 'Uložení se nepodařilo.');
        // Vrátit přepínač zpátky, ať neukazuje něco, co se neuložilo.
        if (telo.uMe !== undefined) setMne(!telo.uMe);
        if (telo.rezim !== undefined) setPortal(rezim);
        return;
      }
      router.refresh();
    } catch {
      setChyba('Uložení se nepodařilo.');
    } finally {
      setUklada(false);
    }
  }

  return (
    <div className="bg-surface rounded-card border border-line shadow-sm p-5 flex flex-col gap-4">
      <div>
        <h2 className="font-heading font-semibold text-ink m-0">Vánoční výzdoba</h2>
        <p className="text-sm font-body text-muted m-0 mt-1">
          Sníh, světýlka u horní hrany a čepice na logu. Rozsvítí se sama 1. prosince a zhasne
          2. ledna; portál se jinak nijak nemění.
          {!bezi && ' Teď není sezóna, takže je ticho tak jako tak.'}
        </p>
      </div>

      <label className="flex items-start gap-2 text-sm font-heading text-ink">
        <input
          type="checkbox"
          checked={mne}
          disabled={uklada}
          onChange={(e) => {
            setMne(e.target.checked);
            void uloz({ uMe: e.target.checked });
          }}
          className="mt-0.5 w-4 h-4 accent-brand-green"
        />
        Chci výzdobu u sebe
      </label>

      {jsemSpravce && (
        <div className="flex flex-col gap-2 border-t border-line pt-3">
          <span className="text-[11px] font-heading uppercase tracking-wide text-muted">
            Celý portál
          </span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {REZIMY.map((r) => (
              <button
                key={r.klic}
                type="button"
                disabled={uklada}
                title={r.popis}
                onClick={() => {
                  setPortal(r.klic);
                  void uloz({ rezim: r.klic });
                }}
                className={`rounded-pill border px-3 py-1.5 text-xs font-heading font-semibold transition-colors ${
                  portal === r.klic
                    ? 'border-brand-green bg-brand-green text-onAccent'
                    : 'border-line text-muted hover:text-brand-purple hover:border-brand-purple'
                }`}
              >
                {r.nazev}
              </button>
            ))}
          </div>
          <p className="text-xs font-body text-muted m-0">
            {REZIMY.find((r) => r.klic === portal)?.popis}
          </p>
        </div>
      )}

      {chyba && <p className="text-sm font-body text-danger m-0">{chyba}</p>}
    </div>
  );
}
