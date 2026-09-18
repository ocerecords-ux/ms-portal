'use client';

import { useEffect, useState } from 'react';

/**
 * MAZÁNÍ SE VŽDYCKY PTÁ PODRUHÉ (zadání 18. 9. 2026: „když chci smazat výkaz.
 * Měla by tam být všude pojistka a zeptat se. Opravdu smazat?").
 *
 * Do té doby se mazalo na jedno kliknutí na půlce míst v portálu - výkaz,
 * bonus, doklad i připomínka zmizely dřív, než si toho člověk stihl všimnout.
 * Tohle je jedno tlačítko pro všechna ta místa, aby se pojistka nikde
 * nezapomněla a všude vypadala stejně.
 *
 * OKÉNKO PROHLÍŽEČE (confirm) SE SCHVÁLNĚ NEPOUŽÍVÁ - vypadá jinak než portál
 * a na telefonu je z něj překlep na jedno ťuknutí. Stejné pravidlo drží
 * hromadné mazání nad tabulkami, viz components/HromadneMazani.tsx.
 *
 * Otázka se sama po chvíli vzdá. Rozmyšlené „ne" je v portálu ta častější
 * odpověď a nikdo nemá nikam klikat jen proto, aby zavřel otázku, kterou
 * nechtěl otevřít.
 */
export function TlacitkoSmazat({
  onSmazat,
  popisek = 'Smazat',
  otazka = 'Opravdu smazat?',
  disabled = false,
  bezi = false,
  /**
   * `odkaz` je textové „Smazat" v řádku tabulky, `tlacitko` je orámované
   * tlačítko pod formulářem. Jinak se chovají stejně.
   */
  varianta = 'odkaz',
  trida = '',
}: {
  /** Co se má stát. Návratová hodnota se nepoužívá - ať se sem dá poslat
   *  i pomocná funkce, která vrací třeba `boolean`. */
  onSmazat: () => unknown;
  popisek?: string;
  otazka?: string;
  disabled?: boolean;
  /** Mazání právě běží - tlačítko to řekne místo popisku. */
  bezi?: boolean;
  varianta?: 'odkaz' | 'tlacitko';
  trida?: string;
}) {
  const [ptaSe, setPtaSe] = useState(false);

  useEffect(() => {
    if (!ptaSe) return;
    const casovac = window.setTimeout(() => setPtaSe(false), 6000);
    return () => window.clearTimeout(casovac);
  }, [ptaSe]);

  const zaklad =
    varianta === 'tlacitko'
      ? 'font-heading font-semibold text-sm rounded-lg border px-4 py-2 transition-colors disabled:opacity-50'
      : 'text-sm font-heading transition-colors disabled:opacity-50';
  const barva = ptaSe
    ? varianta === 'tlacitko'
      ? 'border-danger text-danger bg-dangerTint'
      : 'text-danger font-semibold'
    : varianta === 'tlacitko'
      ? 'border-line text-muted hover:border-danger hover:text-danger'
      : 'text-danger';

  return (
    <button
      type="button"
      disabled={disabled || bezi}
      aria-label={ptaSe ? `${otazka} Klepněte znovu.` : popisek}
      onClick={() => {
        if (!ptaSe) {
          setPtaSe(true);
          return;
        }
        setPtaSe(false);
        void onSmazat();
      }}
      className={`${zaklad} ${barva} ${trida}`}
    >
      {bezi ? 'Mažu…' : ptaSe ? `${otazka} Klepněte znovu` : popisek}
    </button>
  );
}
