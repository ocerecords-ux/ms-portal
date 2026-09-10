'use client';

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
}: {
  hodnota: string;
  moznosti: MoznostOdznaku[];
  onZmena: (hodnota: string) => void;
  /** Barva odznaku - podklad, text, rámeček. */
  trida: string;
  prazdnyPopisek?: string;
  disabled?: boolean;
  titulek?: string;
}) {
  const vybrana = moznosti.find((m) => m.hodnota === hodnota);

  return (
    <span
      title={titulek}
      className={`relative inline-flex items-center gap-1.5 self-start rounded-pill pl-3 pr-2.5 py-1.5 text-xs font-heading font-semibold cursor-pointer focus-within:ring-2 focus-within:ring-brand-purple/40 ${
        disabled ? 'opacity-60' : ''
      } ${trida}`}
    >
      <span className="whitespace-nowrap inline-flex items-center gap-1.5">
        {vybrana?.obsah ?? vybrana?.popisek ?? prazdnyPopisek}
      </span>
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
