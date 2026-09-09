'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { QuickAction, QuickActionKey } from '@/lib/quickActions';

/**
 * Levý panel rychlých voleb (zadání 9. 9. 2026: „vlevo bych chtěl skrývací
 * menu, podobně jako todo list. Budou tam rychlé volby. Měnitelné. Ale
 * v zataženém módu budou jen ikony zelené na fialovém podkladu").
 *
 * Chová se stejně jako panel Úkolů na pravé hraně: zatažený je úzký fialový
 * pruh se zelenými ikonami, rozbalený ukáže i názvy. Který stav to je, si
 * pamatuje prohlížeč (localStorage), takže se panel po přechodu na jinou
 * stránku neotevře znovu sám.
 *
 * Obsah je na každém uživateli zvlášť (model UserQuickAction) a upravuje se
 * přímo v panelu - tři tečky, přetažení za úchyt, křížek na odebrání a „+"
 * na přidání. Stejný způsob jako u horní lišty a u sloupců tabulky.
 */

const STORAGE_KEY = 'ms-quick-dock';

/** Ikony k akcím - patří ke kódu, ne do databáze. */
function Ikona({ akce }: { akce: QuickActionKey }) {
  const spolecne = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.9,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className: 'w-5 h-5 shrink-0',
  };
  switch (akce) {
    case 'objednavka':
      return (
        <svg {...spolecne}>
          <path d="M4 5h2l2.2 9.4a2 2 0 0 0 2 1.6h6.6a2 2 0 0 0 2-1.5L21 8H7" />
          <circle cx="10" cy="20" r="1.2" />
          <circle cx="18" cy="20" r="1.2" />
        </svg>
      );
    case 'nabidka':
      return (
        <svg {...spolecne}>
          <path d="M7 3h7l5 5v13H7z" />
          <path d="M14 3v5h5M10 13h7M10 17h5" />
        </svg>
      );
    case 'faktura':
      return (
        <svg {...spolecne}>
          <path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" />
          <path d="M10 8h4M10 12h4M10 16h2" />
        </svg>
      );
    case 'smlouva':
      return (
        <svg {...spolecne}>
          <path d="M7 3h7l5 5v9a2 2 0 0 1-2 2H7z" />
          <path d="M14 3v5h5" />
          <path d="M9 17c2-3 4 1 6-2" />
        </svg>
      );
    case 'vydaj':
      return (
        <svg {...spolecne}>
          <rect x="3" y="6" width="18" height="12" rx="2" />
          <circle cx="12" cy="12" r="2.4" />
          <path d="M7 12h.01M17 12h.01" />
        </svg>
      );
    case 'termin':
      return (
        <svg {...spolecne}>
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M3 10h18M8 3v4M16 3v4M12 14v4M10 16h4" />
        </svg>
      );
    case 'vykaz':
      return (
        <svg {...spolecne}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      );
    case 'uzivatel':
      return (
        <svg {...spolecne}>
          <circle cx="10" cy="8" r="3.2" />
          <path d="M4 20c0-3.3 2.7-5.4 6-5.4 1.2 0 2.3.3 3.2.8M18 14v6M15 17h6" />
        </svg>
      );
    case 'firma':
      return (
        <svg {...spolecne}>
          <path d="M4 21V7l7-4 7 4v14" />
          <path d="M9 21v-5h4v5M8 10h.01M12 10h.01M16 10h.01" />
        </svg>
      );
  }
}

function Chevron({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <path d={direction === 'right' ? 'M9 6l6 6-6 6' : 'M15 6l-6 6 6 6'} />
    </svg>
  );
}

/** Úchyt na přetahování - šest teček, aby bylo jasné, za co se to bere. */
function Uchyt() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 shrink-0 opacity-70" aria-hidden="true">
      <circle cx="9" cy="6" r="1.5" />
      <circle cx="15" cy="6" r="1.5" />
      <circle cx="9" cy="12" r="1.5" />
      <circle cx="15" cy="12" r="1.5" />
      <circle cx="9" cy="18" r="1.5" />
      <circle cx="15" cy="18" r="1.5" />
    </svg>
  );
}

export function QuickDock({
  actions,
  available,
}: {
  /** Co má uživatel v panelu, v jeho pořadí. */
  actions: QuickAction[];
  /** Co si smí přidat - podle role, řeší server (lib/quickActionsServer.ts). */
  available: QuickAction[];
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<QuickAction[]>(actions);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [taheny, setTaheny] = useState<number | null>(null);

  useEffect(() => {
    try {
      setExpanded(window.localStorage.getItem(STORAGE_KEY) === '1');
    } catch {
      // Prohlizec bez localStorage (privatni rezim) - panel proste zacne zataceny.
    }
  }, []);

  useEffect(() => {
    if (!editing) setDraft(actions);
  }, [actions, editing]);

  function toggle() {
    setExpanded((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
      } catch {
        // Neulozeny stav panelu nikomu nevadi.
      }
      if (!next) setEditing(false);
      return next;
    });
  }

  const zobrazene = editing ? draft : actions;
  const lzePridat = available.filter((a) => !draft.some((d) => d.key === a.key));

  function odeber(key: string) {
    setDraft((current) => current.filter((a) => a.key !== key));
  }

  function pridej(akce: QuickAction) {
    setDraft((current) => (current.some((a) => a.key === akce.key) ? current : [...current, akce]));
  }

  function presun(to: number) {
    setDraft((current) => {
      if (taheny === null || taheny === to) return current;
      const kopie = [...current];
      const [prvek] = kopie.splice(taheny, 1);
      kopie.splice(to, 0, prvek);
      return kopie;
    });
    setTaheny(null);
  }

  async function uloz() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/quick-actions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keys: draft.map((a) => a.key) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error || 'Uložení se nezdařilo.');
        return;
      }
      setEditing(false);
      router.refresh();
    } catch {
      setError('Uložení se nezdařilo.');
    } finally {
      setSaving(false);
    }
  }

  // --- Zatazeno: uzky fialovy pruh se zelenymi ikonami --------------------
  if (!expanded) {
    return (
      <aside className="fixed left-0 top-28 z-40 flex flex-col items-stretch bg-brand-purple rounded-r-card shadow-lg overflow-hidden">
        {actions.map((akce) => (
          <Link
            key={akce.key}
            href={akce.href}
            title={akce.label}
            aria-label={akce.label}
            className="px-2.5 py-2.5 text-brand-green hover:bg-brand-purpleDeep transition-colors flex items-center justify-center no-underline"
          >
            <Ikona akce={akce.key} />
          </Link>
        ))}
        <button
          type="button"
          onClick={toggle}
          title="Zobrazit rychlé volby"
          aria-label="Zobrazit rychlé volby"
          className="px-2.5 py-2 text-brand-green hover:bg-brand-purpleDeep transition-colors flex items-center justify-center border-t border-white/15"
        >
          <Chevron direction="right" />
        </button>
      </aside>
    );
  }

  // --- Rozbaleno: ikony i nazvy ------------------------------------------
  return (
    <aside className="fixed left-0 top-28 z-40 flex items-stretch">
      <div className="w-60 max-w-[70vw] bg-white border border-l-0 border-line rounded-r-card shadow-lg flex flex-col">
        <div className="flex items-center justify-between gap-2 px-3 py-2.5 bg-brand-purple text-white rounded-tr-card">
          <span className="font-heading font-semibold text-xs uppercase tracking-wide">Rychlé volby</span>
          {editing ? (
            <span className="inline-flex items-center gap-2">
              <button
                type="button"
                onClick={uloz}
                disabled={saving}
                className="bg-white text-brand-purpleDeep font-heading font-semibold text-xs rounded-lg px-2.5 py-1 disabled:opacity-60"
              >
                {saving ? 'Ukládám…' : 'Hotovo'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setDraft(actions);
                  setEditing(false);
                  setError(null);
                }}
                className="text-white/80 hover:text-white text-xs font-heading"
              >
                Zrušit
              </button>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  setDraft(actions);
                  setEditing(true);
                  setError(null);
                }}
                title="Upravit rychlé volby"
                aria-label="Upravit rychlé volby"
                className="w-6 h-6 rounded-full text-white/80 hover:text-white hover:bg-white/15 inline-flex flex-col items-center justify-center gap-[3px]"
              >
                <span className="w-[3px] h-[3px] rounded-full bg-current" />
                <span className="w-[3px] h-[3px] rounded-full bg-current" />
                <span className="w-[3px] h-[3px] rounded-full bg-current" />
              </button>
              <button
                type="button"
                onClick={toggle}
                title="Skrýt rychlé volby"
                aria-label="Skrýt rychlé volby"
                className="w-6 h-6 rounded-full text-white/80 hover:text-white hover:bg-white/15 inline-flex items-center justify-center"
              >
                <Chevron direction="left" />
              </button>
            </span>
          )}
        </div>

        <div className="flex flex-col p-2 gap-1">
          {zobrazene.length === 0 && (
            <p className="text-xs font-body text-muted m-0 px-2 py-3">
              Zatím tu nic není. Přidejte si zkratku přes tři tečky.
            </p>
          )}

          {zobrazene.map((akce, index) =>
            editing ? (
              <div
                key={akce.key}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => presun(index)}
                className="flex items-center gap-2 rounded-lg border border-dashed border-line px-2 py-2 text-sm font-heading text-ink"
              >
                <span
                  draggable
                  onDragStart={() => setTaheny(index)}
                  onDragEnd={() => setTaheny(null)}
                  title="Přetažením změníte pořadí"
                  className="cursor-grab active:cursor-grabbing text-muted"
                >
                  <Uchyt />
                </span>
                <span className="text-brand-purple">
                  <Ikona akce={akce.key} />
                </span>
                <span className="truncate flex-1">{akce.label}</span>
                <button
                  type="button"
                  onClick={() => odeber(akce.key)}
                  title={`Odebrat ${akce.label}`}
                  aria-label={`Odebrat ${akce.label}`}
                  className="w-5 h-5 rounded-full bg-field text-muted hover:bg-red-50 hover:text-red-600 text-xs font-bold leading-none flex items-center justify-center"
                >
                  ×
                </button>
              </div>
            ) : (
              <Link
                key={akce.key}
                href={akce.href}
                className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm font-heading text-ink no-underline hover:bg-field transition-colors"
              >
                <span className="text-brand-purple">
                  <Ikona akce={akce.key} />
                </span>
                <span className="truncate">{akce.label}</span>
              </Link>
            ),
          )}

          {editing && (
            <div className="border-t border-line mt-1 pt-2 flex flex-col gap-1">
              {lzePridat.length === 0 ? (
                <p className="text-[11px] font-body text-muted m-0 px-2">Máte tu všechno, co jde přidat.</p>
              ) : (
                <>
                  <span className="text-[10px] font-heading text-muted uppercase tracking-wide px-2">Přidat</span>
                  {lzePridat.map((akce) => (
                    <button
                      key={akce.key}
                      type="button"
                      onClick={() => pridej(akce)}
                      className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-heading text-brand-purple hover:bg-[#F1ECFF] transition-colors text-left"
                    >
                      + {akce.label}
                    </button>
                  ))}
                </>
              )}
            </div>
          )}

          {error && <p className="text-xs text-red-600 m-0 px-2 pt-1">{error}</p>}
        </div>
      </div>
    </aside>
  );
}
