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
    <span className="inline-flex flex-col gap-1 min-w-0">
      <span className="relative inline-flex items-center">
        <select
          value={hodnota}
          disabled={uklada}
          onChange={(e) => void zmen(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          title="Přehodit stav projektu"
          className={`appearance-none cursor-pointer rounded-pill pl-3 pr-7 py-1 text-xs font-heading font-semibold outline-none focus:ring-2 focus:ring-brand-purple/40 disabled:opacity-60 ${barvaStavu(
            hodnota,
            dokonceny,
          )}`}
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
        <Sipka />
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
      className="w-2.5 h-2.5 absolute right-2.5 pointer-events-none opacity-70"
      aria-hidden="true"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}
