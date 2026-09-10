'use client';

import { useEffect, useRef, useState } from 'react';
import { IKONY_TYPU, KresbaIkony, popisekIkony } from '@/lib/ikonyTypu';

/**
 * Výběr ikony u položky ceníku (zadání 10. 9. 2026: „chtěl bych to měnit
 * v ceníku, kde zadáváme typ projektu").
 *
 * Klik na buňku rozbalí celou nabídku - je jich přes dvacet, takže rozbalovací
 * seznam s názvy by nedával smysl: člověk si vybírá podle toho, jak to vypadá,
 * ne podle slova.
 *
 * Ukládá se hned po kliknutí. „Žádná" je plnohodnotná volba, ne prázdno
 * navíc - položka bez ikony ji prostě mít nemusí.
 */
export function VyberIkony({
  hodnota,
  onZmena,
  disabled,
}: {
  hodnota: string | null;
  onZmena: (klic: string) => void;
  disabled?: boolean;
}) {
  const [otevreno, setOtevreno] = useState(false);
  const obal = useRef<HTMLDivElement>(null);

  // Klik mimo nabídku ji zavře - jinak by zůstala viset přes řádky pod sebou.
  useEffect(() => {
    if (!otevreno) return;
    function mimo(e: MouseEvent) {
      if (obal.current && !obal.current.contains(e.target as Node)) setOtevreno(false);
    }
    document.addEventListener('mousedown', mimo);
    return () => document.removeEventListener('mousedown', mimo);
  }, [otevreno]);

  return (
    <div ref={obal} className="relative inline-block">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOtevreno((o) => !o)}
        title={hodnota ? `Ikona: ${popisekIkony(hodnota)}` : 'Vybrat ikonu'}
        className={`inline-grid place-items-center w-[34px] h-[34px] rounded-pill border transition-colors disabled:opacity-60 ${
          hodnota
            ? 'bg-brand-purple/15 text-brand-purpleDeep dark:text-brand-purpleLight border-transparent'
            : 'border-dashed border-line text-muted hover:text-ink'
        }`}
      >
        {hodnota ? <KresbaIkony klic={hodnota} /> : <span className="text-lg leading-none">+</span>}
      </button>

      {otevreno && (
        <div className="absolute z-30 mt-2 left-0 bg-surface border border-line rounded-card shadow-lg p-3 w-[292px]">
          <div className="grid grid-cols-6 gap-1.5">
            {IKONY_TYPU.map((i) => (
              <button
                key={i.klic}
                type="button"
                title={i.popisek}
                onClick={() => {
                  onZmena(i.klic);
                  setOtevreno(false);
                }}
                className={`inline-grid place-items-center w-[42px] h-[42px] rounded-lg transition-colors ${
                  hodnota === i.klic
                    ? 'bg-brand-purple text-white'
                    : 'text-muted hover:bg-field hover:text-brand-purpleDeep dark:hover:text-brand-purpleLight'
                }`}
              >
                <KresbaIkony klic={i.klic} velikost={20} />
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              onZmena('');
              setOtevreno(false);
            }}
            className="mt-3 w-full text-center text-xs font-heading font-semibold text-muted hover:text-danger py-1.5"
          >
            Žádná ikona
          </button>
        </div>
      )}
    </div>
  );
}
