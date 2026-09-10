'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { STAVY_PROJEKTU, barvaStavu } from '@/lib/stavyProjektu';
import { OdznakSelect } from './OdznakSelect';

/**
 * Přehození stavu přímo v seznamu projektů (zadání 10. 9. 2026: "potřebuju,
 * ať se dají přehodit stavy projektu i v seznamu projektů").
 *
 * Vypadá to jako barevný odznak, ale je to rozbalovací nabídka — člověk tedy
 * nemusí kvůli jedné změně otevírat detail projektu. Ukládá se hned po výběru;
 * potvrzovací tlačítko by tady jen překáželo.
 *
 * Vzhled i chování odznaku řeší OdznakSelect - tenhle soubor má na starosti
 * jen ukládání. Stejný odznak je i v detailu projektu, takže stav vypadá na
 * obou místech stejně (zadání 10. 9. 2026).
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
      {/* Vzhled odznaku je spolecny s detailem projektu (OdznakSelect), aby
          stav vypadal na obou mistech stejne - zadani 10. 9. 2026. */}
      <OdznakSelect
        hodnota={hodnota}
        onZmena={(v) => void zmen(v)}
        disabled={uklada}
        trida={barvaStavu(hodnota, dokonceny)}
        titulek="Přehodit stav projektu"
        prazdnyPopisek="Bez stavu"
        moznosti={[
          // Stav prenesený z Caflou, ktery v nasi ceste projektu neni - at se
          // pri rozbaleni nabidky nezmeni na neco jineho.
          ...(neznamyStav ? [{ hodnota, popisek: hodnota }] : []),
          ...STAVY_PROJEKTU.map((s) => ({ hodnota: s.nazev, popisek: s.nazev })),
        ]}
      />
      {chyba && <span className="text-[11px] font-body text-danger">{chyba}</span>}
    </span>
  );
}
