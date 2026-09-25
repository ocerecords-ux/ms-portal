'use client';

import { useState } from 'react';
import {
  DOKDY_NABIDKA,
  HOTOVE_STATUSY,
  popisStatusu,
  type StatusVChatu,
} from '@/lib/statusyChatu';

/**
 * MŮJ STATUS V CHATU (zadání 25. 9. 2026: „a zbytku pak jen nějakou možnost
 * nastavit si individuální status").
 *
 * Proužek nad seznamem rozhovorů: co o mně teď svítí ostatním a jedno
 * klepnutí na změnu. Status z kalendáře (schůzka, casting, režie, Mimo studio)
 * se ukazuje stejně, jen se nedá přepsat - zmizí sám, až událost skončí. Kdo
 * si napíše vlastní, přebije ho, dokud platí.
 */
const pole =
  'rounded-lg border border-line bg-field px-2 py-1.5 text-xs font-body text-ink outline-none focus:border-brand-purple';

function doKdyZKlice(klic: string): string | null {
  const volba = DOKDY_NABIDKA.find((v) => v.klic === klic);
  if (!volba) return null;
  if (volba.minut) return new Date(Date.now() + volba.minut * 60_000).toISOString();
  if (klic === 'dnes') {
    const konec = new Date();
    konec.setHours(23, 59, 0, 0);
    return konec.toISOString();
  }
  return null;
}

export function MujStatus({ status, onZmena }: { status: StatusVChatu | null; onZmena: () => void }) {
  const [otevreno, setOtevreno] = useState(false);
  const [text, setText] = useState(status?.rucni ? status.text : '');
  const [emoji, setEmoji] = useState(status?.rucni ? (status.emoji ?? '') : '');
  const [dokdy, setDokdy] = useState('60');
  const [busy, setBusy] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);

  async function uloz(hodnoty: { text: string; emoji: string; klicDokdy: string }) {
    setBusy(true);
    setChyba(null);
    try {
      const res = await fetch('/api/status', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: hodnoty.text.trim(),
          emoji: hodnoty.emoji || null,
          doKdy: doKdyZKlice(hodnoty.klicDokdy),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setChyba(data?.error || 'Status se nepodařilo uložit.');
        return;
      }
      setOtevreno(false);
      onZmena();
    } catch {
      setChyba('Status se nepodařilo uložit.');
    } finally {
      setBusy(false);
    }
  }

  async function zrus() {
    setBusy(true);
    setChyba(null);
    try {
      const res = await fetch('/api/status', { method: 'DELETE' });
      if (!res.ok) {
        setChyba('Status se nepodařilo zrušit.');
        return;
      }
      setText('');
      setEmoji('');
      setOtevreno(false);
      onZmena();
    } catch {
      setChyba('Status se nepodařilo zrušit.');
    } finally {
      setBusy(false);
    }
  }

  if (!otevreno) {
    return (
      <button
        type="button"
        onClick={() => setOtevreno(true)}
        title="Nastavit status"
        className="w-full text-left rounded-lg border border-line bg-field/60 hover:bg-field px-2.5 py-1.5 flex items-center gap-2"
      >
        <span className="text-base leading-none">{status?.emoji ?? '💬'}</span>
        <span className={`flex-1 min-w-0 truncate text-xs font-body ${status ? 'text-ink' : 'text-muted'}`}>
          {status ? popisStatusu(status) : 'Nastavit status…'}
        </span>
        {status && !status.rucni && (
          // Aby bylo jasné, proč to nejde jen tak smazat.
          <span className="shrink-0 text-[10px] font-heading uppercase tracking-wide text-muted">z kalendáře</span>
        )}
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-brand-purple/40 bg-tint/40 p-2 flex flex-col gap-2">
      {status && !status.rucni && (
        <p className="m-0 text-[11px] font-body text-muted">
          Teď o vás svítí <b className="font-heading text-ink">{popisStatusu(status)}</b> z kalendáře. Vlastní status
          ho přebije, dokud platí.
        </p>
      )}

      {/* Hotové statusy na jedno klepnutí - psát „Na obědě" ručně je zbytečné. */}
      <div className="flex flex-wrap gap-1">
        {HOTOVE_STATUSY.map((h) => (
          <button
            key={h.text}
            type="button"
            disabled={busy}
            onClick={() => void uloz({ text: h.text, emoji: h.emoji, klicDokdy: h.klicDokdy })}
            className="rounded-pill border border-line bg-surface px-2 py-1 text-[11px] font-heading text-ink hover:border-brand-purple disabled:opacity-50"
          >
            {h.emoji} {h.text}
          </button>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim()) void uloz({ text, emoji, klicDokdy: dokdy });
        }}
        className="flex flex-col gap-1.5"
      >
        <div className="flex items-center gap-1.5">
          <input
            value={emoji}
            onChange={(e) => setEmoji(e.target.value)}
            placeholder="🙂"
            aria-label="Emoji"
            className={`${pole} w-12 text-center`}
          />
          <input
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Co teď děláte?"
            maxLength={80}
            aria-label="Status"
            className={`${pole} flex-1 min-w-0`}
          />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <label className="text-[11px] font-heading text-muted">Platí</label>
          <select value={dokdy} onChange={(e) => setDokdy(e.target.value)} className={`${pole} flex-1 min-w-0`}>
            {DOKDY_NABIDKA.map((v) => (
              <option key={v.klic} value={v.klic}>
                {v.popisek}
              </option>
            ))}
          </select>
        </div>
        {chyba && <span className="text-[11px] font-body text-danger">{chyba}</span>}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="submit"
            disabled={busy || !text.trim()}
            className="bg-brand-purple text-white font-heading font-semibold text-xs rounded-lg px-3 py-1.5 disabled:opacity-50"
          >
            Nastavit
          </button>
          <button
            type="button"
            onClick={() => setOtevreno(false)}
            className="text-xs font-heading text-muted hover:text-ink px-1"
          >
            Zpět
          </button>
          <span className="flex-1" />
          {status?.rucni && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void zrus()}
              className="text-xs font-heading font-semibold text-danger hover:underline px-1"
            >
              Zrušit status
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

/** Status vedle jména - jeden řádek, ať nerozhodí seznam rozhovorů. */
export function RadekStatusu({ status }: { status: StatusVChatu | null | undefined }) {
  if (!status) return null;
  return (
    <span className="block text-[11px] font-body text-muted truncate">
      {status.emoji ? `${status.emoji} ` : ''}
      {popisStatusu(status)}
    </span>
  );
}
