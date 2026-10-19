'use client';

import { useState } from 'react';
import { usePreklad } from '@/app/(portal)/components/JazykProvider';

/**
 * VYSTAVIT A ODESLAT FAKTURU Z NABÍDKY (19. 10. 2026).
 *
 * U reklam to portál dělá sám, jakmile zakázka přeskočí do „Schváleno -
 * k fakturaci". Jenže automat jede na PŘECHODU do stavu, ne na tom, že
 * v něm projekt stojí: zakázka, která do stavu přeskočila dřív - nebo u které
 * automat odstoupil, protože něco chybělo - se sama nerozjede a stav by se
 * musel přehazovat tam a zpátky.
 *
 * Tlačítko je proto vidět JEN TAM, KDE DÁVÁ SMYSL: právě jedna nabídka
 * a zatím žádná faktura. Jakmile faktura vznikne, zmizí.
 *
 * PTÁ SE PŘED ODESLÁNÍM. Je to ostrý doklad, který odejde klientovi a posune
 * číselnou řadu - to se neodklepává omylem.
 */
export function FakturaZNabidky({ caflouProjectId }: { caflouProjectId: string }) {
  const t = usePreklad();
  const [bezi, setBezi] = useState(false);
  const [hlaska, setHlaska] = useState<{ ok: boolean; text: string } | null>(null);

  async function spustit() {
    if (bezi) return;
    if (!window.confirm(t('projektDoklady.fakturaZNabidkyPotvrzeni'))) return;
    setBezi(true);
    setHlaska(null);
    try {
      const res = await fetch(
        `/api/projekty/${encodeURIComponent(caflouProjectId)}/automaticka-faktura`,
        { method: 'POST' },
      );
      const telo = (await res.json().catch(() => null)) as
        | { ok?: boolean; zprava?: string; error?: string }
        | null;
      const text = telo?.zprava || telo?.error || t('projektDoklady.fakturaZNabidkyChyba');
      setHlaska({ ok: res.ok && telo?.ok === true, text });
      // Když faktura opravdu vznikla, ať je v seznamu dokladů hned vidět.
      if (res.ok && telo?.ok === true) setTimeout(() => window.location.reload(), 2500);
    } catch {
      setHlaska({ ok: false, text: t('projektDoklady.fakturaZNabidkyChyba') });
    } finally {
      setBezi(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={spustit}
        disabled={bezi}
        className="inline-flex w-fit items-center gap-2 rounded-pill border border-brand-purple px-3.5 py-1.5 text-sm font-heading font-semibold text-brand-purple transition-colors hover:bg-brand-purple hover:text-white disabled:opacity-60"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4"
        >
          <path d="M4 4h16v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
          <path d="M8 9h8M8 13h5" />
        </svg>
        {bezi ? t('projektDoklady.fakturaZNabidkyBezi') : t('projektDoklady.fakturaZNabidky')}
      </button>
      {hlaska && (
        <p
          className={`m-0 text-sm font-body ${hlaska.ok ? 'text-status-done' : 'text-danger'}`}
          role="status"
        >
          {hlaska.text}
        </p>
      )}
    </div>
  );
}
