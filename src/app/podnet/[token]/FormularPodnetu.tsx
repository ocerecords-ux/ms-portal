'use client';

import { useState } from 'react';

/**
 * Jedno pole, jedno tlačítko (18. 11. 2026). Adresu se portál ptá jen tehdy,
 * když ji nezná z Posluchačů - jinak by to byla otázka navíc pro nic.
 */
export function FormularPodnetu({ token, znameAdresu }: { token: string; znameAdresu: boolean }) {
  const [text, setText] = useState('');
  const [email, setEmail] = useState('');
  const [stav, setStav] = useState<'PISE' | 'POSILA' | 'HOTOVO'>('PISE');
  const [chyba, setChyba] = useState<string | null>(null);

  async function odesli() {
    if (text.trim().length < 3) return;
    setStav('POSILA');
    setChyba(null);
    try {
      const res = await fetch(`/api/podnet/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, ...(znameAdresu ? {} : { email }) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setChyba(data?.error || 'Podnět se nepodařilo odeslat.');
        setStav('PISE');
        return;
      }
      setStav('HOTOVO');
    } catch {
      setChyba('Podnět se nepodařilo odeslat.');
      setStav('PISE');
    }
  }

  if (stav === 'HOTOVO') {
    return (
      <div className="rounded-lg bg-okTint p-4">
        <p className="font-heading font-semibold text-sm m-0">Díky, máme to.</p>
        <p className="font-body text-sm text-muted mt-1 mb-0">
          Podnět šel rovnou mezi připomínky k portálu. Okno můžete zavřít.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        maxLength={4000}
        placeholder="Co vám v AudioTaggeru chybělo nebo zlobilo?"
        className="w-full rounded-lg border border-line bg-field px-3 py-2 text-sm font-body text-ink outline-none focus:border-brand-purple resize-none"
      />
      {!znameAdresu && (
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Váš e-mail (nepovinné)"
          className="w-full rounded-lg border border-line bg-field px-3 py-2 text-sm font-body text-ink outline-none focus:border-brand-purple"
        />
      )}
      {chyba && <p className="text-sm font-body text-danger m-0">{chyba}</p>}
      <button
        type="button"
        onClick={() => void odesli()}
        disabled={stav === 'POSILA' || text.trim().length < 3}
        className="self-start bg-brand-green text-onAccent font-heading font-bold text-sm rounded-lg px-5 py-2.5 disabled:opacity-50"
      >
        {stav === 'POSILA' ? 'Odesílám…' : 'Odeslat'}
      </button>
    </div>
  );
}
