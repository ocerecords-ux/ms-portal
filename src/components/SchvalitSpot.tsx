'use client';

import { useState } from 'react';
import { formatDatum, formatDatumCas } from '@/lib/jazyk';
import { useJazyk, usePreklad } from '@/app/(portal)/components/JazykProvider';

/**
 * TLAČÍTKO „SCHVÁLIT" (zadání 18. 9. 2026, popisek sjednocen tentýž den).
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
  projekt,
  schvalenoAt,
  zvyraznit = false,
  varianta = 'karta',
}: {
  /** Token z mailu - klient se nepřihlašuje. */
  token?: string;
  /** ID projektu - pro přihlášeného klienta v portálu. */
  projekt?: string;
  /** ISO datum, kdy klient schválil; null = ještě ne. */
  schvalenoAt: string | null;
  /** Přišel z mailu rovnou na schválení - ať to netápe, kde tlačítko je. */
  zvyraznit?: boolean;
  /** `karta` je pruh s vysvětlením, `radek` je samotné tlačítko do tabulky. */
  varianta?: 'karta' | 'radek';
}) {
  const t = usePreklad();
  const jazyk = useJazyk();
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
        body: JSON.stringify(token ? { k: token } : { projekt }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setChyba(data?.error || t('spot.schvaleniNeulozeno'));
        return;
      }
      setHotovoAt(data?.schvalenoAt ?? new Date().toISOString());
      setPtaSe(false);
    } catch {
      setChyba(t('spot.schvaleniNeulozeno'));
    } finally {
      setBezi(false);
    }
  }

  if (hotovoAt && varianta === 'radek') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-heading font-semibold text-status-done whitespace-nowrap">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 shrink-0">
          <path d="M4 12l6 6L20 6" />
        </svg>
        {formatDatum(jazyk, new Date(hotovoAt))}
      </span>
    );
  }

  if (varianta === 'radek') {
    return (
      <span className="inline-flex flex-col items-start gap-0.5">
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
          title={t('spot.bublinaFakturace')}
          className={`font-heading font-semibold text-xs rounded-lg px-3 py-1.5 transition-colors disabled:opacity-60 whitespace-nowrap ${
            ptaSe ? 'bg-brand-purple text-white' : 'bg-brand-green text-onAccent'
          }`}
        >
          {bezi ? t('obecne.ukladam') : ptaSe ? t('spot.opravduKlepnete') : t('spot.schvalit')}
        </button>
        {chyba && <span className="text-[11px] font-body text-danger">{chyba}</span>}
      </span>
    );
  }

  if (hotovoAt) {
    return (
      <div className="rounded-card border border-brand-green bg-okTint px-4 py-3 flex items-center gap-2.5 flex-wrap">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-status-done shrink-0">
          <path d="M4 12l6 6L20 6" />
        </svg>
        <span className="font-heading font-semibold text-sm text-ink">{t('spot.jeSchvalena')}</span>
        <span className="text-xs font-body text-muted">
          {formatDatumCas(jazyk, new Date(hotovoAt))}
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
          {t('spot.vPoradku')}
        </span>
        <span className="block text-xs font-body text-muted">
          {t('spot.vysvetleni')}
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
        {bezi ? t('obecne.ukladam') : ptaSe ? t('spot.opravduSchvalitKlepnete') : t('spot.schvalit')}
      </button>
    </div>
  );
}
