'use client';

import { Children, Fragment, isValidElement, type ReactNode } from 'react';
import { VyberSLupou, PRAH_LUPY, type MoznostVyberu } from './VyberSLupou';

/**
 * Náhrada za obyčejný <select> (zadání 15. 9. 2026: „všechna pole prosím
 * vyhledávací s lupou. Pojďme to tak nastavit na celém portálu u polí, kde
 * bude více jak pět položek").
 *
 * Používá se ÚPLNĚ STEJNĚ jako <select> - včetně <option> uvnitř a
 * `onChange={(e) => ...e.target.value}`. Rozdíl je jen v tom, že když je
 * v nabídce víc než pět možností, místo rolovacího seznamu se ukáže políčko
 * s lupou, do kterého se píše. Kratší seznam zůstává seznamem.
 *
 * Proč přes children a ne přes pole hodnot: takhle šlo pole vyměnit na všech
 * obrazovkách portálu naráz, bez přepisování každé nabídky zvlášť - a když se
 * někde přidá <option>, chová se to samo od sebe správně.
 */

type Volba = MoznostVyberu & { disabled?: boolean };

/** Text z children <option> - bývá to řetězec nebo pár kousků za sebou. */
function textZDeti(deti: ReactNode): string {
  const kusy: string[] = [];
  Children.toArray(deti).forEach((d) => {
    if (typeof d === 'string' || typeof d === 'number') kusy.push(String(d));
    else if (isValidElement(d)) kusy.push(textZDeti((d.props as { children?: ReactNode }).children));
  });
  return kusy.join('').replace(/\s+/g, ' ').trim();
}

/** Projde <option> i <optgroup> a udělá z nich seznam možností. */
function sesbirej(deti: ReactNode, skupina?: string): Volba[] {
  const out: Volba[] = [];
  Children.toArray(deti).forEach((d) => {
    if (!isValidElement(d)) return;
    const props = d.props as { value?: unknown; children?: ReactNode; disabled?: boolean; label?: string };
    if (d.type === 'option') {
      out.push({
        hodnota: props.value === undefined ? textZDeti(props.children) : String(props.value),
        popisek: textZDeti(props.children),
        poznamka: skupina,
        disabled: props.disabled,
      });
    } else if (d.type === 'optgroup') {
      out.push(...sesbirej(props.children, props.label));
    } else if (d.type === Fragment) {
      // Podminkou obalene skupiny (<>…</>) - Children.toArray je nerozbali.
      out.push(...sesbirej(props.children, skupina));
    }
  });
  return out;
}

export function VyberPole({
  value,
  onChange,
  children,
  className,
  disabled,
  required,
  id,
  title,
  placeholder,
  'aria-label': ariaLabel,
}: {
  /** Číslo se bere jako text - v <select> to tak taky funguje (sazba DPH, hodina). */
  value: string | number;
  /** Stejný tvar jako u <select>, ať se volající kód nemusí měnit. */
  onChange: (e: { target: { value: string } }) => void;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  id?: string;
  title?: string;
  placeholder?: string;
  'aria-label'?: string;
}) {
  const hodnota = value === null || value === undefined ? '' : String(value);
  const volby = sesbirej(children);
  // Prázdná volba („— bez projektu —") se nepočítá mezi položky a v poli
  // s lupou z ní je nabídka „zrušit výběr".
  const prazdna = volby.find((v) => v.hodnota === '');
  const plne = volby.filter((v) => v.hodnota !== '' && !v.disabled);

  if (plne.length <= PRAH_LUPY) {
    return (
      <select
        id={id}
        value={value}
        onChange={onChange}
        className={className}
        disabled={disabled}
        required={required}
        title={title}
        aria-label={ariaLabel}
      >
        {children}
      </select>
    );
  }

  return (
    <VyberSLupou
      id={id}
      moznosti={plne}
      hodnota={hodnota}
      onZmena={(v) => onChange({ target: { value: v } })}
      prazdnyPopisek={prazdna?.popisek}
      placeholder={placeholder ?? 'Hledejte psaním…'}
      disabled={disabled}
      required={required}
      className={className}
    />
  );
}
