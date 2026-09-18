'use client';

import { useState } from 'react';

/**
 * TLAČÍTKO „SPOT SCHVALUJI" (zadání 18. 9. 2026).
 *
 * Je na dvou místech, kam se klient z mailu dostane: ve složce s nahrávkami
 * a v taggeru spotu. Obojí jede přes stejný token, takže je to tatáž
 * komponenta.
 *
 * PTÁ SE PODRUHÉ. Schválením se projekt překlopí do „Schváleno - k fakturaci"
 * a jde se fakturovat - to není akce na jedno nedopatřené ťuknutí. Stejná
 * pojistka jako u mazání v portálu, jen obráceně barevně.
 *
 * Po schválení se tlačítko změní na klidnou větu s datem. Zpátky to klient
 * vzít nemůže; kdyby se spletl, napíše nám - a stav přehodíme my.
 */
export function SchvalitSpot({
  token,
  schvalenoAt,
  zvyraznit = false,
}: {
  token: string;
  /** ISO datum, kdy klient schválil; null = ještě ne. */
  schvalenoAt: string | null;
  /** Přišel z mailu rovnou na schválení - ať to netápe, kde tlačítko je. */
  zvyraznit?: boolean;
}) {
  const [hotovoAt, setHotovoAt] = useState<string | null>(schvalenoAt);
  const [ptaSe, setPtaSe] = useState(false);
  const [bezi, setBezi] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);

  async function schval() {
    if (bezi) return;
    setBezi(true);
    setChyba(null);
    try {
      const res = await fetch('/api/reklama/schvaleni', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ k: token }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setChyba(data?.error || 'Schválení se nepodařilo uložit.');
        return;
      }
      setHotovoAt(data?.schvalenoAt ?? new Date().toISOString());
      setPtaSe(false);
    } catch {
      setChyba('Schválení se nepodařilo uložit.');
    } finally {
      setBezi(false);
    }
  }

  if (hotovoAt) {
    return (
      <div className="rounded-card border border-brand-green bg-okTint px-4 py-3 flex items-center gap-2.5 flex-wrap">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-status-done shrink-0">
          <path d="M4 12l6 6L20 6" />
        </svg>
        <span className="font-heading font-semibold text-sm text-ink">Spot je schválený</span>
        <span className="text-xs font-body text-muted">
          {new Intl.DateTimeFormat('cs-CZ', {
            day: 'numeric',
            month: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          }).format(new Date(hotovoAt))}
        </span>
      </div>
    );
  }

  return (
    <div
      className={`rounded-card border px-4 py-3 flex items-center gap-3 flex-wrap ${
        zvyraznit ? 'border-brand-green bg-okTint' : 'border-line bg-surface'
      }`}
    >
      <div className="min-w-0 flex-1">
        <span className="block font-heading font-semibold text-sm text-ink">
          Je spot v pořádku?
        </span>
        <span className="block text-xs font-body text-muted">
          Schválením nám dáte vědět, že je hotovo — projekt tím jde k fakturaci. Když je co
          upravit, napište to radši do připomínek.
        </span>
      </div>
      {chyba && <span className="w-full text-xs font-body text-danger">{chyba}</span>}
      <button
        type="button"
        disabled={bezi}
        onClick={() => {
          if (!ptaSe) {
            setPtaSe(true);
            return;
          }
          void schval();
        }}
        className={`shrink-0 font-heading font-semibold text-sm rounded-lg px-5 py-2.5 transition-colors disabled:opacity-60 ${
          ptaSe
            ? 'bg-brand-purple text-white hover:bg-brand-purpleDeep'
            : 'bg-brand-green text-onAccent'
        }`}
      >
        {bezi ? 'Ukládám…' : ptaSe ? 'Opravdu schválit? Klepněte znovu' : 'Schválit spot'}
      </button>
    </div>
  );
}
