'use client';

import { useRef } from 'react';

/**
 * Políčko s datem (zadání 15. 9. 2026: „pole datum se musí dát vybrat hodnota
 * z kalendáře. Opět skrz celý portál").
 *
 * Je to obyčejný <input type="date">, ale kalendář se otevře kliknutím
 * KAMKOLIV do pole, ne jen na drobnou ikonku vpravo. To je celý rozdíl -
 * a zároveň důvod, proč má portál jedno společné políčko místo dvaceti
 * různých inputů: stačí ho opravit na jednom místě.
 *
 * `showPicker()` umí Chrome, Edge i Safari; kde není, spadne to do try/catch
 * a pole se chová jako dřív (datum jde napsat z klávesnice vždycky).
 */
export function DatumPole({
  value,
  onChange,
  className,
  disabled,
  required,
  id,
  min,
  max,
  title,
  onBlur,
  autoFocus,
}: {
  value: string;
  /** Stejný tvar jako u <input>, ať se volající kód nemusí měnit. */
  onChange: (e: { target: { value: string } }) => void;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  id?: string;
  min?: string;
  max?: string;
  title?: string;
  onBlur?: () => void;
  /** Políčko, které se objeví až po kliknutí (buňka v tabulce), chce fokus rovnou. */
  autoFocus?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);

  function otevriKalendar() {
    const pole = ref.current as (HTMLInputElement & { showPicker?: () => void }) | null;
    try {
      pole?.showPicker?.();
    } catch {
      // Prohlížeč picker neotevřel (typicky proto, že už je otevřený).
    }
  }

  return (
    <input
      id={id}
      ref={ref}
      type="date"
      value={value}
      onChange={onChange}
      onBlur={onBlur}
      autoFocus={autoFocus}
      onClick={otevriKalendar}
      disabled={disabled}
      required={required}
      min={min}
      max={max}
      title={title}
      className={className}
    />
  );
}
