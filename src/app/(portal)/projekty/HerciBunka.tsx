'use client';

import { useState } from 'react';
import { TRIDA_BUBLINY_DOTOCENO, TRIDA_BUBLINY_HERCE, TRIDA_ODZNAKU_STRANY } from '@/lib/bublinaHerce';

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
export function HerciBunka({
  herci,
}: {
  herci: { jmeno: string; dotoceno: boolean; strana?: number | null }[];
}) {
  const [rozbaleno, setRozbaleno] = useState(false);
  const VIDITELNYCH = 2;
  const zobrazeni = rozbaleno ? herci : herci.slice(0, VIDITELNYCH);
  const skryto = herci.length - zobrazeni.length;

  return (
    // pr-3 a gap-2: odznak preteka pres pravy horni roh bubliny, takze si
    // vpravo i nahore musi sloupec nechat misto - jinak by zajel do vedlejsiho
    // sloupce nebo na bublinu nad sebou.
    <span className="flex flex-col items-start gap-2 py-2 pr-3 min-w-0 max-w-full">
      {zobrazeni.map((h, i) => (
        // relative: odznak je index posazeny na bublinu, ne sourozenec vedle ni
        // (upresneni 13. 9. 2026). Kotvi se k teto obalce.
        <span key={`${h.jmeno}-${i}`} className="relative inline-flex max-w-full">
          <span
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
          {/* Strana z natacecího protokolu - jen cislo, at prehled zustane
              prehledem (zadani 13. 9. 2026: „mohlo by se to objevit i v tom
              prehledu jako maly odznak - jen cislo"). Po dotoceni mizi: tam uz
              strana nic nerika.

              POSAZENY NA ROH BUBLINY jako index (upresneni 13. 9. 2026).
              Zaporne posuny ho vytahnou pres okraj, aby roh prekryval;
              pointer-events-none, at neprekazi kliknuti na bublinu pod nim. */}
          {!h.dotoceno && typeof h.strana === 'number' && (
            <span
              title={`Natočeno do strany ${h.strana} — zapsal Bruno z chatu`}
              className={`pointer-events-none absolute -top-2 -right-2 z-10 inline-flex items-center justify-center min-w-[20px] h-[18px] px-1 text-[10px] font-heading font-bold tabular-nums leading-none ${TRIDA_ODZNAKU_STRANY}`}
            >
              {h.strana}
              <span className="sr-only"> — natočeno do strany</span>
            </span>
          )}
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
