'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { KresbaIkony, tridaBarvyIkony } from '@/lib/ikonyTypu';

/**
 * VÝBĚR V MALÉM OKNĚ (zadání 26. 9. 2026: „všechna ta funkční tlačítka
 * přesunout až do vyskakovacího okna po kliknutí").
 *
 * Na řádku je jen pilulka s tím, co je vybrané; klepnutím se u ní otevře
 * okno se zaškrtávátky. Čtrnáct jmen vedle sebe by se na řádek nikdy
 * nevešlo. Používá to záložka Výstupy i Licenční list, ať se obě chovají
 * stejně.
 */

const SIRKA_OKNA = 240;

export type PolozkaVyberu = { id: string; nazev: string; ikona: string | null };

export function VyberVOkne({
  popisek,
  prazdne,
  polozky,
  vybrane,
  zdedene = [],
  onZmena,
  onPridatJmeno,
  jedno = false,
  disabled,
}: {
  popisek: string;
  /** Co je na tlačítku, když není vybráno nic - „herci", „licence". */
  prazdne: string;
  polozky: PolozkaVyberu[];
  vybrane: string[];
  /** Co by se použilo, kdyby zůstalo prázdno (downcut dědí po hlavním spotu). */
  zdedene?: string[];
  onZmena: (ids: string[]) => void;
  /** Když je vyplněné, jde v okně dopsat položku, která v seznamu není. */
  onPridatJmeno?: (jmeno: string) => void;
  /** Vybírá se jen jedna položka (výstup), ne několik. */
  jedno?: boolean;
  disabled?: boolean;
}) {
  const [kotva, setKotva] = useState<{ left: number; top: number } | null>(null);
  const [pridavane, setPridavane] = useState('');
  const oknoRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!kotva || !oknoRef.current) return;
    const r = oknoRef.current.getBoundingClientRect();
    if (r.bottom > window.innerHeight - 8) {
      const novyVrsek = Math.max(8, window.innerHeight - r.height - 8);
      if (Math.abs(novyVrsek - kotva.top) > 1) setKotva({ ...kotva, top: novyVrsek });
    }
  }, [kotva]);

  useEffect(() => {
    if (!kotva) return;
    /**
     * Okno se zavírá při posouvání stránky (jinak by zůstalo viset mimo své
     * tlačítko), ale NE při posouvání uvnitř sebe - čtrnáct herců se do něj
     * nevejde a rolovat v nich musí jít (27. 9. 2026: „když rozkliknu seznam
     * herců, tak v tom nemůžu rolovat").
     */
    const zavri = (e?: Event) => {
      const cil = e?.target;
      if (cil instanceof Node && oknoRef.current?.contains(cil)) return;
      setKotva(null);
    };
    const klavesa = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setKotva(null);
    };
    const mimo = (e: MouseEvent) => {
      if (oknoRef.current && !oknoRef.current.contains(e.target as Node)) setKotva(null);
    };
    window.addEventListener('keydown', klavesa);
    window.addEventListener('scroll', zavri, true);
    window.addEventListener('resize', zavri);
    const t = window.setTimeout(() => document.addEventListener('mousedown', mimo), 0);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('keydown', klavesa);
      window.removeEventListener('scroll', zavri, true);
      window.removeEventListener('resize', zavri);
      document.removeEventListener('mousedown', mimo);
    };
  }, [kotva]);

  const jmena = polozky.filter((p) => vybrane.includes(p.id));
  const dedi = vybrane.length === 0 && zdedene.length > 0;
  const zdedenaJmena = polozky.filter((p) => zdedene.includes(p.id));
  const napis =
    jmena.length > 0
      ? jmena.map((j) => j.nazev).join(', ')
      : dedi
        ? `${zdedenaJmena.map((j) => j.nazev).join(', ')} (dědí)`
        : prazdne;

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        title={`${popisek}: ${napis}`}
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setKotva({
            left: Math.min(r.left, window.innerWidth - SIRKA_OKNA - 8),
            top: r.bottom + 6,
          });
        }}
        className={`shrink-0 max-w-[190px] truncate rounded-pill border px-3 py-1.5 text-xs font-heading transition-colors disabled:opacity-60 ${
          jmena.length > 0
            ? 'border-brand-purple/50 bg-brand-purple/10 text-brand-purpleDeep dark:text-brand-purpleLight'
            : 'border-dashed border-line bg-transparent text-muted hover:text-ink'
        }`}
      >
        {jmena.length > 1 ? `${popisek} · ${jmena.length}` : napis}
      </button>

      {kotva && (
        <div
          ref={oknoRef}
          style={{ position: 'fixed', left: kotva.left, top: kotva.top, width: SIRKA_OKNA }}
          className="z-[90] flex flex-col gap-0.5 rounded-card border border-line bg-surface shadow-2xl p-2 max-h-72 overflow-y-auto"
        >
          <span className="px-2 py-1 text-[11px] font-heading text-muted uppercase tracking-wide">
            {popisek}
          </span>
          {polozky.length === 0 ? (
            <span className="px-2 py-1.5 text-sm font-body text-muted">Není z čeho vybrat.</span>
          ) : (
            polozky.map((p) => {
              const zaskrtnuto = vybrane.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  role="checkbox"
                  aria-checked={zaskrtnuto}
                  onClick={() => {
                    if (jedno) {
                      onZmena([p.id]);
                      setKotva(null);
                      return;
                    }
                    onZmena(zaskrtnuto ? vybrane.filter((x) => x !== p.id) : [...vybrane, p.id]);
                  }}
                  className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded-lg text-sm font-heading text-ink bg-transparent border-0 cursor-pointer hover:bg-field transition-colors"
                >
                  <span
                    className={`grid place-items-center w-4 h-4 shrink-0 border ${
                      jedno ? 'rounded-full' : 'rounded-[5px]'
                    } ${zaskrtnuto ? 'bg-brand-purple border-brand-purple text-white' : 'border-line bg-field'}`}
                  >
                    {zaskrtnuto && (
                      <svg viewBox="0 0 24 24" width={10} height={10} fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12.5l4.5 4.5L19 7" />
                      </svg>
                    )}
                  </span>
                  {p.ikona && (
                    <span className={`grid place-items-center w-5 h-5 rounded-full shrink-0 ${tridaBarvyIkony(p.ikona)}`}>
                      <KresbaIkony klic={p.ikona} velikost={11} />
                    </span>
                  )}
                  <span className="truncate">{p.nazev}</span>
                </button>
              );
            })
          )}

          {/* Kdo není v seznamu, jde dopsat rovnou tady - u licenčních listů
              se stává, že herec ještě nemá účet (22. 9. 2026). */}
          {onPridatJmeno && (
            <input
              value={pridavane}
              onChange={(e) => setPridavane(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== 'Enter' || !pridavane.trim()) return;
                e.preventDefault();
                onPridatJmeno(pridavane.trim());
                setPridavane('');
              }}
              placeholder="Dopsat jméno a Enter…"
              className="mt-1 w-full rounded-lg border border-line bg-field px-2 py-1.5 text-sm font-body text-ink outline-none focus:border-brand-purple"
            />
          )}
        </div>
      )}
    </>
  );
}
