'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Políčko s datem (zadání 15. 9. 2026: „pole datum se musí dát vybrat hodnota
 * z kalendáře. Opět skrz celý portál").
 *
 * Je to obyčejný <input type="date">, ale kalendář se otevře kliknutím
 * KAMKOLIV do pole, ne jen na drobnou ikonku vpravo. To je celý rozdíl -
 * a zároveň důvod, proč má portál jedno společné políčko místo dvaceti
 * různých inputů: stačí ho opravit na jednom místě.
 *
 * ROZEPSANÉ DATUM SE UŽ NEZTRATÍ (oprava 25. 9. 2026: „klienti si stěžují, že
 * když zadají měsíc, tak jim to datum zmizí, když kliknou jinam").
 *
 * Proč se to dělo: dokud nejsou vyplněné všechny tři části, vrací prohlížeč
 * `value` jako prázdný řetězec. Formulář si tedy uložil prázdno, React políčko
 * překreslil - a smazal tím i to, co člověk stihl napsat. Vypadalo to, že
 * portál datum zahodil, přitom si ho sám přepsal.
 *
 * Jak je to teď:
 *  - políčko si drží SVOU hodnotu, dokud v něm člověk píše; zvenčí se přepíše,
 *    jen když v něm zrovna nikdo nestojí,
 *  - ven se hlásí jen HOTOVÉ datum; prázdno až při odchodu z políčka,
 *  - při odchodu se pozná rozepsané od vymazaného (`validity.badInput`):
 *    rozepsané se vrátí na původní hodnotu, vymazané se uloží jako prázdno.
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
  'aria-label': ariaLabel,
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
  'aria-label'?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  /** Co je vidět v políčku. Rozepsané datum vrací prohlížeč jako "". */
  const [vlastni, setVlastni] = useState(value);
  const pisu = useRef(false);

  // Zvenčí se hodnota přebírá, jen když v políčku nikdo nepíše - jinak by
  // překreslení smazalo rozepsané části.
  useEffect(() => {
    if (!pisu.current) setVlastni(value);
  }, [value]);

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
      value={vlastni}
      aria-label={ariaLabel}
      onFocus={() => {
        pisu.current = true;
      }}
      onChange={(e) => {
        const nova = e.target.value;
        setVlastni(nova);
        // Prázdno (rozepsané nebo vymazané) se ven hlásí až při odchodu -
        // viz onBlur níž.
        if (nova) onChange(e);
      }}
      onBlur={() => {
        pisu.current = false;
        const pole = ref.current;
        if (pole && pole.value === '') {
          if (pole.validity.badInput) {
            // Rozepsané datum: vrátíme, co v políčku bylo, ať se nic neztratí.
            setVlastni(value);
          } else if (value !== '') {
            // Opravdu vymazané: teď má smysl uložit prázdno.
            onChange({ target: { value: '' } });
          }
        }
        onBlur?.();
      }}
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
