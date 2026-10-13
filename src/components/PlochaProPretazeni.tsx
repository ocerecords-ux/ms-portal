'use client';

import { useRef, useState, type DragEvent, type ReactNode } from 'react';

/**
 * PŘETAŽENÍ SOUBORU DO PLOCHY (zadání 13. 10. 2026 od Karolíny Zbořilové:
 * „Bylo by možné vkládat přílohu pouze přetažením a ne nahráním z pc? Jde mi
 * o výdaje. Když stáhnu přílohu z emailu, tak ji musím nahrát z pc a ne jen
 * přetáhnutím.")
 *
 * Obalí cokoli a přijme soubory puštěné kamkoli dovnitř - stažený soubor
 * z pošty, obrázek z plochy, přílohu přetaženou rovnou z Mailu. Tlačítko pro
 * výběr z disku zůstává tam, kde bylo - tohle je cesta navíc, ne náhrada.
 *
 * REAGUJE JEN NA SOUBORY. Když se po stránce táhne text nebo se přehazuje
 * pořadí dlaždic, plocha se vůbec nerozsvítí a drží se stranou.
 *
 * POČÍTADLO VNOŘENÍ: `dragleave` přijde i při přejezdu na vnitřní prvek, takže
 * podle něj samotného by zvýraznění problískalo. Počítá se proto, kolikrát
 * kurzor dovnitř vstoupil a kolikrát vystoupil.
 */
export function PlochaProPretazeni({
  onSoubory,
  popisek,
  vypnuto = false,
  bezBoxu = false,
  className = '',
  children,
}: {
  /** Co s puštěnými soubory. Prázdné pole se sem nikdy nedostane. */
  onSoubory: (soubory: File[]) => void;
  /** Věta přes plochu ve chvíli, kdy nad ní soubor visí. */
  popisek: string;
  /** Například když se zrovna nahrává - puštěný soubor se zahodí. */
  vypnuto?: boolean;
  /**
   * OBAL NEMÁ VLASTNÍ BOX (`display: contents`). Pro místa, kde je obalovaný
   * prvek položený rozložením rodiče - dlaždice v mřížce, pružný sloupec,
   * ukotvený panel. Obyčejný `div` by se mezi ně vložil a rozložení
   * rozházel; takhle se chová, jako by tam nebyl, a zvýraznění si sedne na
   * obalovaný prvek - ten proto musí mít `relative` (nebo `fixed`).
   */
  bezBoxu?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const [nadPlochou, setNadPlochou] = useState(false);
  const hloubka = useRef(0);

  const nesouSoubory = (e: DragEvent) =>
    Array.from(e.dataTransfer?.types ?? []).includes('Files');

  function konec() {
    hloubka.current = 0;
    setNadPlochou(false);
  }

  return (
    <div
      className={bezBoxu ? 'contents' : `relative ${className}`}
      onDragEnter={(e) => {
        if (vypnuto || !nesouSoubory(e)) return;
        e.preventDefault();
        hloubka.current += 1;
        setNadPlochou(true);
      }}
      onDragOver={(e) => {
        if (vypnuto || !nesouSoubory(e)) return;
        // Bez tohohle prohlížeč soubor neupustí a otevře ho místo toho v okně.
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      }}
      onDragLeave={(e) => {
        if (vypnuto || !nesouSoubory(e)) return;
        hloubka.current -= 1;
        if (hloubka.current <= 0) konec();
      }}
      onDrop={(e) => {
        if (vypnuto || !nesouSoubory(e)) return;
        e.preventDefault();
        konec();
        const soubory: File[] = e.dataTransfer ? Array.from(e.dataTransfer.files) : [];
        if (soubory.length > 0) onSoubory(soubory);
      }}
    >
      {children}
      {nadPlochou && (
        <div className="absolute inset-0 z-10 rounded-lg border-2 border-dashed border-brand-purple bg-brand-purple/10 backdrop-blur-[1px] flex items-center justify-center pointer-events-none">
          <span className="font-heading font-semibold text-sm text-brand-purple bg-surface/90 rounded-lg px-3 py-1.5">
            {popisek}
          </span>
        </div>
      )}
    </div>
  );
}
