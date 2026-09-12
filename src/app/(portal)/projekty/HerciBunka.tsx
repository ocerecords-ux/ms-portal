'use client';

import { useState } from 'react';
import { TRIDA_BUBLINY_DOTOCENO, TRIDA_BUBLINY_HERCE } from '@/lib/bublinaHerce';

/**
 * Herci v přehledu projektů (zadání 12. 9. 2026: „ti herci vypadají v přehledu
 * hrozně. Pojďme to udělat tak, že budou pod sebou a roztáhne se celý řádek
 * projektu vertikálně. Když tam bude víc jak dva, tak se tam objeví tři tečky
 * pod sebou a kliknutím na ně se ukážou další. Hlavně nesmí být nic
 * useknuté.").
 *
 * PROČ TO NENÍ JEN CSS: dřív byla vidět první bublina a za ní „+2". Jméno se
 * do bubliny nevešlo a uřízlo se uprostřed — u herce, kterého člověk v seznamu
 * hledá, je to k ničemu. Teď má každý svůj řádek, řádek projektu se o to
 * zvýší a nic se neořezává.
 *
 * DVA A DOST. Kdyby se vysypali všichni, projekt s pěti herci by roztáhl
 * seznam natolik, že by se v něm nedalo listovat. Tři tečky pod bublinami
 * zbytek odkryjí — a druhým klepnutím zase schovají.
 */
export function HerciBunka({ herci }: { herci: { jmeno: string; dotoceno: boolean }[] }) {
  const [rozbaleno, setRozbaleno] = useState(false);
  const VIDITELNYCH = 2;
  const zobrazeni = rozbaleno ? herci : herci.slice(0, VIDITELNYCH);
  const skryto = herci.length - zobrazeni.length;

  return (
    <span className="flex flex-col items-start gap-1 py-2 min-w-0 max-w-full">
      {zobrazeni.map((h, i) => (
        <span
          key={`${h.jmeno}-${i}`}
          // break-words a normalni zalamovani: dlouhe jmeno radsi na dva radky
          // nez uriznute. Vetsina se vejde na jeden.
          className={`inline-flex max-w-full px-3 py-1 text-sm font-heading font-semibold leading-snug whitespace-normal break-words ${
            h.dotoceno ? TRIDA_BUBLINY_DOTOCENO : TRIDA_BUBLINY_HERCE
          }`}
        >
          {h.jmeno}
          {/* Zelena linka kolem bubliny znamena dotoceno; pro ctecky obrazovky,
              ktere barvu nevidi, zustava popisek. */}
          {h.dotoceno && <span className="sr-only"> — dotočeno</span>}
        </span>
      ))}

      {(skryto > 0 || rozbaleno) && (
        <button
          type="button"
          onClick={() => setRozbaleno((r) => !r)}
          title={rozbaleno ? 'Schovat zbylé herce' : `Ukázat další herce (${skryto})`}
          aria-label={rozbaleno ? 'Schovat zbylé herce' : `Ukázat další herce (${skryto})`}
          aria-expanded={rozbaleno}
          className="inline-flex flex-col items-center justify-center gap-[3px] px-2 py-1 rounded-pill text-muted hover:text-brand-purple hover:bg-brand-purple/10 transition-colors"
        >
          {rozbaleno ? (
            <span className="text-[11px] font-heading font-semibold leading-none">skrýt</span>
          ) : (
            <>
              <span className="block w-[3px] h-[3px] rounded-full bg-current" />
              <span className="block w-[3px] h-[3px] rounded-full bg-current" />
              <span className="block w-[3px] h-[3px] rounded-full bg-current" />
            </>
          )}
        </button>
      )}
    </span>
  );
}
