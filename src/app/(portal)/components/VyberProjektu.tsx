'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * Výběr projektu psaním (zadání 11. 9. 2026: „myslel jsem, že by šlo hledat
 * právě v tom rolovacím seznamu, kde zadáváš projekt ve výkazu").
 *
 * Obyčejný <select> se sedmi sty položkami je k nepoužití — rolovat se v něm
 * dá jen očima a prohlížeč v něm hledá nejvýš podle prvního písmene. Tohle je
 * políčko, do kterého se píše, a seznam se pod ním rovnou zužuje.
 *
 * Hledá se BEZ OHLEDU NA DIAKRITIKU a po slovech nezávisle na pořadí, stejně
 * jako v přehledu projektů — „audioteka cerny" najde projekt Audioteky
 * s Černým, ať je napsaný jakkoliv.
 *
 * Dokončené projekty jsou v nabídce taky, ale až za rozdělanými a označené —
 * výkaz se k dokončenému projektu píše běžně (práce se dodělává i po
 * uzavření), jen se na něj nemá kliknout omylem.
 */

export type ProjektKVyberu = {
  id: string;
  label: string;
  dokonceny?: boolean;
};

/** Porovnávací tvar - bez diakritiky, malými písmeny. */
function zjednodus(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

function sedi(projekt: ProjektKVyberu, hledani: string): boolean {
  if (!hledani) return true;
  const seno = zjednodus(`${projekt.label} ${projekt.id}`);
  return zjednodus(hledani)
    .split(/\s+/)
    .filter(Boolean)
    .every((slovo) => seno.includes(slovo));
}

/** Kolik položek se najednou vykreslí. Víc než tohle stejně nikdo nepřečte. */
const STROP = 60;

export function VyberProjektu({
  projekty,
  hodnota,
  onZmena,
  disabled,
  placeholder = 'Začněte psát název projektu, firmu nebo číslo…',
}: {
  projekty: ProjektKVyberu[];
  /** ID vybraného projektu, nebo prázdno. */
  hodnota: string;
  onZmena: (id: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [hledani, setHledani] = useState('');
  const [otevreno, setOtevreno] = useState(false);
  const [zvyrazneny, setZvyrazneny] = useState(0);
  const obal = useRef<HTMLDivElement>(null);
  const poleRef = useRef<HTMLInputElement>(null);

  const vybrany = projekty.find((p) => p.id === hodnota) ?? null;

  const nalezene = useMemo(() => {
    const shody = projekty.filter((p) => sedi(p, hledani.trim()));
    // Rozdelane driv nez dokoncene - to je to, co clovek hleda v devadesati
    // procentech pripadu.
    return [...shody].sort((a, b) => Number(a.dokonceny ?? false) - Number(b.dokonceny ?? false));
  }, [projekty, hledani]);

  const viditelne = nalezene.slice(0, STROP);

  /**
   * Nabídku zavírá klik MIMO ni, ne opuštění políčka — blur přijde už při
   * zmáčknutí tlačítka myši, zatímco klik až při puštění, takže na onBlur by
   * se položka pod kurzorem stihla ztratit dřív, než by se na ni kliklo.
   * Stejně to řeší i výběr herců.
   */
  useEffect(() => {
    if (!otevreno) return;
    function mimo(e: MouseEvent) {
      if (obal.current && !obal.current.contains(e.target as Node)) setOtevreno(false);
    }
    document.addEventListener('mousedown', mimo);
    return () => document.removeEventListener('mousedown', mimo);
  }, [otevreno]);

  useEffect(() => {
    setZvyrazneny(0);
  }, [hledani, otevreno]);

  function vyber(p: ProjektKVyberu) {
    onZmena(p.id);
    setHledani('');
    setOtevreno(false);
    poleRef.current?.blur();
  }

  const trida =
    'w-full rounded-lg border bg-field pl-9 pr-9 py-2.5 text-ink font-heading text-sm outline-none transition-colors';

  return (
    <div ref={obal} className="relative">
      <input
        ref={poleRef}
        type="text"
        role="combobox"
        aria-expanded={otevreno}
        aria-autocomplete="list"
        disabled={disabled}
        value={otevreno ? hledani : (vybrany?.label ?? '')}
        placeholder={vybrany ? vybrany.label : placeholder}
        onFocus={() => {
          setHledani('');
          setOtevreno(true);
        }}
        onChange={(e) => {
          setHledani(e.target.value);
          setOtevreno(true);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setOtevreno(true);
            setZvyrazneny((i) => Math.min(i + 1, viditelne.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setZvyrazneny((i) => Math.max(i - 1, 0));
          } else if (e.key === 'Enter') {
            if (otevreno && viditelne[zvyrazneny]) {
              e.preventDefault();
              vyber(viditelne[zvyrazneny]);
            }
          } else if (e.key === 'Escape') {
            e.preventDefault();
            setOtevreno(false);
            setHledani('');
          }
        }}
        className={`${trida} ${
          otevreno ? 'border-brand-purple' : vybrany ? 'border-line' : 'border-line'
        } ${disabled ? 'opacity-60' : ''}`}
      />

      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        aria-hidden="true"
        className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-3.5-3.5" />
      </svg>

      {vybrany && !otevreno && !disabled && (
        <button
          type="button"
          onClick={() => onZmena('')}
          title="Zrušit výběr"
          aria-label="Zrušit výběr projektu"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 grid place-items-center rounded-full text-muted hover:text-danger hover:bg-surface"
        >
          ×
        </button>
      )}

      {otevreno && (
        <div className="absolute z-30 left-0 right-0 mt-1 max-h-[280px] overflow-y-auto rounded-lg border border-line bg-surface shadow-lg">
          {viditelne.length === 0 ? (
            <p className="text-sm font-body text-muted m-0 px-3 py-3">
              Nic takového jsme nenašli. Zkuste jen část názvu nebo jméno firmy.
            </p>
          ) : (
            <ul className="list-none m-0 p-1 flex flex-col">
              {viditelne.map((p, i) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onMouseEnter={() => setZvyrazneny(i)}
                    onClick={() => vyber(p)}
                    className={`w-full text-left flex items-center gap-2 rounded-md px-2.5 py-2 text-sm font-body transition-colors ${
                      i === zvyrazneny ? 'bg-tint text-ink' : 'text-ink hover:bg-surfaceSoft'
                    }`}
                  >
                    <span className="flex-1 min-w-0 truncate">{p.label}</span>
                    {p.dokonceny && (
                      <span className="shrink-0 text-[10px] font-heading font-semibold uppercase tracking-wide text-muted bg-field border border-line rounded-pill px-1.5 py-0.5">
                        dokončeno
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {nalezene.length > viditelne.length && (
            <p className="text-[11px] font-body text-muted m-0 px-3 py-2 border-t border-line">
              Zobrazeno prvních {viditelne.length} z {nalezene.length} — pište dál a seznam se zúží.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
