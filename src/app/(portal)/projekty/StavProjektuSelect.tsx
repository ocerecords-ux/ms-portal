'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { STAVY_PROJEKTU, barvaStavu } from '@/lib/stavyProjektu';

/**
 * Přehození stavu přímo v seznamu projektů (zadání 10. 9. 2026: "potřebuju,
 * ať se dají přehodit stavy projektu i v seznamu projektů").
 *
 * Vypadá to jako barevný odznak, ale je to rozbalovací nabídka — člověk tedy
 * nemusí kvůli jedné změně otevírat detail projektu. Ukládá se hned po výběru;
 * potvrzovací tlačítko by tady jen překáželo.
 *
 * ŠÍŘKA PODLE TEXTU (zadání 10. 9. 2026: "ty bubliny, kde je stav projektu,
 * by mohly mít různou velikost - podle textu"): samotný <select> se v
 * prohlížeči roztáhne na nejdelší položku nabídky, takže i „V přípravě" měla
 * bublina šířku „Dokončeno - ke schválení". Odznak je proto obyčejný <span>
 * s vybraným textem a <select> na něm leží průhledně přes celou plochu —
 * klikání i klávesnice fungují dál, ale o šířce rozhoduje text.
 *
 * Když uložení selže, stav se vrátí na původní hodnotu a vypíše se chyba pod
 * odznakem. Tabulka nesmí ukazovat něco jiného, než co je v databázi.
 */
export function StavProjektuSelect({
  caflouProjectId,
  stav,
  dokonceny,
}: {
  caflouProjectId: string;
  stav: string;
  dokonceny: boolean;
}) {
  const router = useRouter();
  const [hodnota, setHodnota] = useState(stav);
  const [uklada, setUklada] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);

  async function zmen(novy: string) {
    const puvodni = hodnota;
    setHodnota(novy);
    setUklada(true);
    setChyba(null);
    try {
      const res = await fetch(`/api/projects/${caflouProjectId}/meta`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statusName: novy }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setHodnota(puvodni);
        setChyba(data?.error || 'Stav se nepodařilo uložit.');
        return;
      }
      // Projekt může změnou stavu přeskočit mezi záložkami Aktivní
      // a Dokončené - proto se seznam načte znovu, ne jen tahle buňka.
      router.refresh();
    } catch {
      setHodnota(puvodni);
      setChyba('Stav se nepodařilo uložit.');
    } finally {
      setUklada(false);
    }
  }

  const neznamyStav = hodnota && !STAVY_PROJEKTU.some((s) => s.nazev === hodnota);

  return (
    <span className="inline-flex flex-col gap-1 min-w-0 items-start">
      <span
        className={`relative inline-flex items-center gap-1.5 rounded-pill pl-3 pr-2.5 py-1 text-xs font-heading font-semibold cursor-pointer focus-within:ring-2 focus-within:ring-brand-purple/40 ${
          uklada ? 'opacity-60' : ''
        } ${barvaStavu(hodnota, dokonceny)}`}
      >
        <span className="whitespace-nowrap">{hodnota || 'Bez stavu'}</span>
        <Sipka />
        <select
          value={hodnota}
          disabled={uklada}
          onChange={(e) => void zmen(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          title="Přehodit stav projektu"
          aria-label="Stav projektu"
          className="absolute inset-0 w-full h-full appearance-none opacity-0 cursor-pointer outline-none disabled:cursor-default"
        >
          {/* Stav prenesený z Caflou, který v naší cestě projektu není - ať se
              při rozbalení nabídky nezmění na něco jiného. */}
          {neznamyStav && <option value={hodnota}>{hodnota}</option>}
          {STAVY_PROJEKTU.map((s) => (
            <option key={s.nazev} value={s.nazev}>
              {s.nazev}
            </option>
          ))}
        </select>
      </span>
      {chyba && <span className="text-[11px] font-body text-danger">{chyba}</span>}
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
