'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Rozbalovací nabídka, která vypadá jako barevný odznak (zadání 10. 9. 2026:
 * „ať to vypadá jak v přehledu projektu — ten typ projektu s ikonou, stav
 * v barvě").
 *
 * ODZNAK JE TEN OVLADAČ, ne popisek vedle něj. Napřed byl v detailu obyčejný
 * <select> a pod ním barevný odznak s touž hodnotou — tatáž věc dvakrát pod
 * sebou. Tady je to jeden prvek: vypadá jako v přehledu a zároveň se přes
 * něj vybírá.
 *
 * JAK: samotný <select> se v prohlížeči roztáhne na nejdelší položku nabídky
 * a obarvit se pořádně nedá. Odznak je proto obyčejný <span> s vybranou
 * hodnotou a <select> na něm leží průhledně přes celou plochu — klikání
 * i klávesnice fungují dál, ale o vzhledu i šířce rozhoduje odznak.
 *
 * BEZ KLÁVES (zadání 23. 9. 2026: „když mám rozbalenou u projektu nabídku
 * změny stavu, tak tam tu chvíli fungujou klávesové zkratky a to je špatně,
 * protože se člověk občas uklikne a změní stav").
 *
 * Systémová nabídka <select> sama reaguje na klávesy: šipka, písmeno i kolečko
 * myši hodnotu přehodí - a protože se stav ukládá hned, je změna hotová dřív,
 * než si toho někdo všimne. S `bezKlaves` se proto nevykreslí <select>, ale
 * vlastní nabídka, kde se VYBÍRÁ JEN MYŠÍ. Klávesnice v ní nedělá nic než
 * Esc (zavřít) - nabídku nejde zavřít omylem s jinou hodnotou, než na kterou
 * člověk klikl.
 */
export type MoznostOdznaku = {
  hodnota: string;
  popisek: string;
  /** Co se ukáže v odznaku, když je tahle možnost vybraná (ikona + text). */
  obsah?: React.ReactNode;
};

export function OdznakSelect({
  hodnota,
  moznosti,
  onZmena,
  trida,
  prazdnyPopisek = '— nevybráno —',
  disabled,
  titulek,
  bezKlaves = false,
}: {
  hodnota: string;
  moznosti: MoznostOdznaku[];
  onZmena: (hodnota: string) => void;
  /** Barva odznaku - podklad, text, rámeček. */
  trida: string;
  prazdnyPopisek?: string;
  disabled?: boolean;
  titulek?: string;
  /** Vybírá se jen myší - klávesy ani kolečko hodnotu nezmění. */
  bezKlaves?: boolean;
}) {
  const vybrana = moznosti.find((m) => m.hodnota === hodnota);
  const obsahOdznaku = vybrana?.obsah ?? vybrana?.popisek ?? prazdnyPopisek;

  if (bezKlaves) {
    return (
      <NabidkaJenMysi
        hodnota={hodnota}
        moznosti={moznosti}
        onZmena={onZmena}
        trida={trida}
        prazdnyPopisek={prazdnyPopisek}
        disabled={disabled}
        titulek={titulek}
        obsahOdznaku={obsahOdznaku}
      />
    );
  }

  return (
    <span
      title={titulek}
      className={`relative inline-flex items-center gap-1.5 self-start max-w-full rounded-pill pl-3 pr-2.5 py-1.5 text-xs font-heading font-semibold cursor-pointer focus-within:ring-2 focus-within:ring-brand-purple/40 ${
        disabled ? 'opacity-60' : ''
      } ${trida}`}
    >
      {/* V uzkem sloupci se dlouhy stav orizne TREMI TECKAMI primo uvnitr
          odznaku (zadani 12. 9. 2026). Kdyby se oriznul az bunkou, useklo by
          to odznak v pulce i s pozadim a vypadalo by to jako chyba. */}
      <span className="min-w-0 truncate inline-flex items-center gap-1.5">{obsahOdznaku}</span>
      <Sipka />
      <select
        value={hodnota}
        disabled={disabled}
        onChange={(e) => onZmena(e.target.value)}
        className="absolute inset-0 w-full h-full appearance-none opacity-0 cursor-pointer outline-none disabled:cursor-default"
      >
        <option value="">{prazdnyPopisek}</option>
        {moznosti.map((m) => (
          <option key={m.hodnota} value={m.hodnota}>
            {m.popisek}
          </option>
        ))}
      </select>
    </span>
  );
}

/**
 * Tatáž nabídka, ale vlastní - bez systémového <select>, takže ji žádná
 * klávesa ani kolečko myši nepřehodí. Vybírá se klepnutím na položku.
 */
function NabidkaJenMysi({
  hodnota,
  moznosti,
  onZmena,
  trida,
  prazdnyPopisek,
  disabled,
  titulek,
  obsahOdznaku,
}: {
  hodnota: string;
  moznosti: MoznostOdznaku[];
  onZmena: (hodnota: string) => void;
  trida: string;
  prazdnyPopisek: string;
  disabled?: boolean;
  titulek?: string;
  obsahOdznaku: React.ReactNode;
}) {
  const [otevreno, setOtevreno] = useState(false);
  const obal = useRef<HTMLSpanElement | null>(null);

  // Zavřít klepnutím vedle a klávesou Esc. Esc je jediná klávesa, která tu
  // něco dělá - a hodnotu nemění.
  useEffect(() => {
    if (!otevreno) return;
    const vedle = (e: MouseEvent) => {
      if (obal.current && !obal.current.contains(e.target as Node)) setOtevreno(false);
    };
    const klavesa = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOtevreno(false);
    };
    document.addEventListener('mousedown', vedle);
    document.addEventListener('keydown', klavesa);
    return () => {
      document.removeEventListener('mousedown', vedle);
      document.removeEventListener('keydown', klavesa);
    };
  }, [otevreno]);

  const vyber = (v: string) => {
    setOtevreno(false);
    if (v !== hodnota) onZmena(v);
  };

  const polozky = [{ hodnota: '', popisek: prazdnyPopisek }, ...moznosti];

  return (
    <span ref={obal} className="relative inline-flex self-start max-w-full">
      <span
        role="button"
        tabIndex={-1}
        title={titulek}
        aria-haspopup="listbox"
        aria-expanded={otevreno}
        onClick={() => {
          if (!disabled) setOtevreno((o) => !o);
        }}
        className={`inline-flex items-center gap-1.5 max-w-full rounded-pill pl-3 pr-2.5 py-1.5 text-xs font-heading font-semibold ${
          disabled ? 'opacity-60 cursor-default' : 'cursor-pointer'
        } ${trida}`}
      >
        <span className="min-w-0 truncate inline-flex items-center gap-1.5">{obsahOdznaku}</span>
        <Sipka />
      </span>

      {otevreno && !disabled && (
        <span
          role="listbox"
          className="absolute left-0 top-full mt-1.5 z-40 min-w-[220px] max-w-[min(90vw,320px)] max-h-[60vh] overflow-y-auto rounded-card border border-line bg-surface shadow-lg p-1 flex flex-col"
        >
          {polozky.map((m) => (
            <span
              key={m.hodnota || 'prazdno'}
              role="option"
              aria-selected={m.hodnota === hodnota}
              onClick={() => vyber(m.hodnota)}
              className={`text-left rounded-lg px-3 py-2 text-sm font-body cursor-pointer transition-colors ${
                m.hodnota === hodnota
                  ? 'bg-tint text-ink font-heading font-semibold'
                  : 'text-ink hover:bg-tint'
              }`}
            >
              {m.popisek}
            </span>
          ))}
        </span>
      )}
    </span>
  );
}

function Sipka() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-2.5 h-2.5 shrink-0 pointer-events-none opacity-70"
      aria-hidden="true"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}
