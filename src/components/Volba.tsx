'use client';

import type { ReactNode } from 'react';

/**
 * JEDNOTNÉ ZAŠKRTÁVÁTKO PORTÁLU (zadání 19. 9. 2026: „zaškrtávátka bych
 * udělal v grafice, jak máme třeba kalendáře nebo licence… a držel bych to
 * všude").
 *
 * Kulatý štítek jako u licencí v detailu projektu: vybraný má fialový rámeček,
 * podbarvení a okénko s fajfkou; nevybraný je bledý s čárkovaným okrajem, ať
 * je na první pohled vidět, co platí. Volitelná barevná tečka je z přepínačů
 * kalendářů - u studií a lokací nese jejich barvu.
 *
 * Používá se všude, kde se vybírá víc možností naráz (studia, lokace, role,
 * druhy zakázek…). Jednotlivé ano/ne volby (plátce DPH, souhlas s podmínkami)
 * zůstávají obyčejným zaškrtávacím polem - tam není z čeho vybírat.
 */
export function Volba({
  vybrano,
  onZmena,
  children,
  barva,
  disabled,
  title,
  maly,
}: {
  vybrano: boolean;
  onZmena: (nove: boolean) => void;
  children: ReactNode;
  /** Barevná tečka (studio, lokace). Bez ní se tečka nekreslí. */
  barva?: string | null;
  disabled?: boolean;
  title?: string;
  /** Menší varianta do hustých míst (seznam lidí v chatu). */
  maly?: boolean;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={vybrano}
      disabled={disabled}
      title={title}
      onClick={() => onZmena(!vybrano)}
      className={`inline-flex items-center gap-2 rounded-pill border font-heading font-semibold transition-colors disabled:cursor-default ${
        maly ? 'pl-1.5 pr-2.5 py-1 text-xs' : 'pl-2 pr-3.5 py-1.5 text-sm'
      } ${
        vybrano
          ? 'border-brand-purple bg-brand-purple/10 text-brand-purpleDeep dark:text-brand-purpleLight'
          : 'border-dashed border-line bg-transparent text-muted opacity-70 hover:opacity-100 hover:text-ink'
      }`}
    >
      <span
        aria-hidden="true"
        className={`grid place-items-center w-4 h-4 rounded-[5px] border transition-colors shrink-0 ${
          vybrano ? 'bg-brand-purple border-brand-purple text-white' : 'border-line bg-field'
        }`}
      >
        {vybrano && (
          <svg viewBox="0 0 24 24" width={11} height={11} fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12.5l4.5 4.5L19 7" />
          </svg>
        )}
      </span>
      {barva && (
        <span
          aria-hidden="true"
          className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ backgroundColor: vybrano ? barva : '#C9C3DC' }}
        />
      )}
      <span className="min-w-0">{children}</span>
    </button>
  );
}

/** Přepne hodnotu v seznamu vybraných - pro `onZmena` u skupin. */
export function prepniVSeznamu<T>(seznam: T[], hodnota: T, zapnout: boolean): T[] {
  return zapnout ? (seznam.includes(hodnota) ? seznam : [...seznam, hodnota]) : seznam.filter((x) => x !== hodnota);
}
