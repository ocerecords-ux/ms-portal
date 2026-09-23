'use client';

import { useState } from 'react';
import type { PoznamkaProjektu } from '@/lib/poznamkyProjektuServer';

/**
 * POZNÁMKY U PROJEKTU (zadání 23. 9. 2026: „udělal bych u projektu taky
 * v detailu Poznámky, kde se bude dát vložit poznámka. Primárně bych tam
 * propisoval i poznámky z objednávek").
 *
 * Nahoře políčko na novou poznámku, pod ním, co kdo napsal - nejnovější
 * první. Úplně dole poznámka klienta z objednávky; ta se nedá mazat ani
 * upravovat, protože není naše (čte se rovnou z objednávky).
 *
 * Vidí to Žůžo-labůžo a produkce, zvukař ne - záložka se mu vůbec neukáže.
 */

function kdyText(iso: string): string {
  return new Intl.DateTimeFormat('cs-CZ', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

export function PoznamkyProjektu({
  caflouProjectId,
  pocatecni,
  jaId,
  jsemAdmin,
}: {
  caflouProjectId: string;
  pocatecni: PoznamkaProjektu[];
  jaId: string;
  jsemAdmin: boolean;
}) {
  const [poznamky, setPoznamky] = useState<PoznamkaProjektu[]>(pocatecni);
  const [text, setText] = useState('');
  const [uklada, setUklada] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);

  const adresa = `/api/projekty/${encodeURIComponent(caflouProjectId)}/poznamky`;

  async function pridej() {
    const cisty = text.trim();
    if (!cisty || uklada) return;
    setUklada(true);
    setChyba(null);
    try {
      const odpoved = await fetch(adresa, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: cisty }),
      });
      const data = await odpoved.json().catch(() => null);
      if (!odpoved.ok) throw new Error(data?.error || 'Poznámku se nepodařilo uložit.');
      setPoznamky(data.poznamky ?? []);
      setText('');
    } catch (err) {
      setChyba(err instanceof Error ? err.message : 'Poznámku se nepodařilo uložit.');
    } finally {
      setUklada(false);
    }
  }

  async function smaz(id: string) {
    setChyba(null);
    try {
      const odpoved = await fetch(`${adresa}?poznamka=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      const data = await odpoved.json().catch(() => null);
      if (!odpoved.ok) throw new Error(data?.error || 'Poznámku se nepodařilo smazat.');
      setPoznamky(data.poznamky ?? []);
    } catch (err) {
      setChyba(err instanceof Error ? err.message : 'Poznámku se nepodařilo smazat.');
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-card border border-line bg-surface p-4 flex flex-col gap-2.5">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-body text-ink">Nová poznámka</span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              // Cmd/Ctrl+Enter odešle - poznámka je krátká věc, člověk u ní
              // nechce sahat po myši.
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                e.preventDefault();
                void pridej();
              }
            }}
            rows={3}
            placeholder="Co je u téhle zakázky potřeba vědět…"
            className="rounded-lg border border-line bg-field px-3 py-2.5 text-ink font-body text-sm outline-none focus:border-brand-purple resize-y"
          />
        </label>
        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => void pridej()}
            disabled={uklada || text.trim().length === 0}
            className="bg-brand-purple text-white font-heading font-semibold text-sm rounded-lg px-5 py-2.5 hover:bg-brand-purpleDeep transition-colors disabled:opacity-50"
          >
            {uklada ? 'Ukládám…' : 'Přidat poznámku'}
          </button>
          <span className="text-xs font-body text-muted">
            Vidí je jen Žůžo-labůžo a produkce.
          </span>
        </div>
        {chyba && <p className="text-sm font-body text-danger m-0">{chyba}</p>}
      </div>

      {poznamky.length === 0 ? (
        <p className="text-sm font-body text-muted m-0">
          Zatím tu nic není. Poznámka z objednávky se sem propíše sama, jakmile nějaká přijde.
        </p>
      ) : (
        <ul className="list-none p-0 m-0 flex flex-col gap-2.5">
          {poznamky.map((p) => (
            <li
              key={p.id}
              className={`rounded-card border px-4 py-3 flex flex-col gap-1.5 ${
                p.zObjednavky ? 'border-brand-purple bg-tint' : 'border-line bg-surface'
              }`}
            >
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-heading font-semibold text-sm text-ink">{p.autorJmeno}</span>
                <span className="text-xs font-body text-muted">{kdyText(p.kdy)}</span>
                {p.zObjednavky && (
                  <span className="text-[11px] font-heading uppercase tracking-[0.1em] text-brand-purple">
                    Z objednávky
                  </span>
                )}
                {!p.zObjednavky && (p.autorId === jaId || jsemAdmin) && (
                  <button
                    type="button"
                    onClick={() => void smaz(p.id)}
                    className="ml-auto text-xs font-heading text-muted hover:text-danger transition-colors"
                  >
                    Smazat
                  </button>
                )}
              </div>
              <p className="text-sm font-body text-ink m-0 whitespace-pre-wrap">{p.text}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
