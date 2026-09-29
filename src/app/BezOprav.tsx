'use client';

import { useEffect } from 'react';

/**
 * Vypnutí automatických oprav textu v celém portálu (zadání 10. 9. 2026).
 *
 * PROČ TO NESTAČÍ NAPSAT NA <body>: `spellcheck` a `autocapitalize` se
 * z rodiče dědí, ale `autocorrect` (Safari a iOS) ne — ten musí být na
 * každém poli zvlášť. A právě iOS je místo, kde opravy vadí nejvíc: sám
 * si přepisuje jména herců, názvy knih a zkratky studií na "známější"
 * slova.
 *
 * Pole tedy označíme jedno po druhém a hlídáme i ta, která přibudou
 * později (rozbalený formulář, dialog, nová řádka tabulky). Zapisují se
 * jen atributy, žádné čtení layoutu, takže to nic nezdržuje.
 *
 * Co se schválně NEVYPÍNÁ: `autocomplete`. Ten není oprava textu, ale
 * nabídka vlastních dřívějších hodnot a hesel ze správce — ta je užitečná.
 *
 * A POLE, KTERÁ SI O OPRAVY ŘEKNOU (oprava 29. 9. 2026: „ty opravy slov
 * pořád nefungují").
 *
 * Tohle byl ten pravý důvod, proč v chatu opravy nešly: psátko si atributy
 * nastavuje samo, jenže tenhle hlídač mu je po vykreslení zase přepsal na
 * vypnuto. V DOMu pak stálo `spellcheck="false"` a `autocorrect="off"`,
 * i když v kódu psátka stojí opak — takže se dvakrát opravovalo něco, co
 * stejně nemohlo fungovat.
 *
 * Pravidlo z 10. 9. 2026 platí dál a je správné: v projektech, dokladech
 * a kalendáři si iOS přepisuje jména herců, názvy knih a zkratky studií na
 * „známější" slova a to je horší než pár překlepů. Ale chat je věta, ne
 * údaj — tam opravy patří. Kdo je chce, napíše si na pole `data-opravy`
 * a hlídač ho vynechá.
 */
const ATRIBUTY: [string, string][] = [
  ['autocorrect', 'off'],
  ['autocapitalize', 'off'],
  ['spellcheck', 'false'],
];

/** Pole, kterých se hlídač nedotkne - viz `data-opravy` v komentáři výše. */
const VYBER =
  'input:not([data-opravy]), textarea:not([data-opravy]), [contenteditable="true"]:not([data-opravy])';

function oznac(korenu: ParentNode) {
  const pole = korenu.querySelectorAll<HTMLElement>(VYBER);
  for (const prvek of Array.from(pole)) {
    for (const [jmeno, hodnota] of ATRIBUTY) {
      if (prvek.getAttribute(jmeno) !== hodnota) prvek.setAttribute(jmeno, hodnota);
    }
  }
}

export function BezOprav() {
  useEffect(() => {
    oznac(document);

    const sledovani = new MutationObserver((zmeny) => {
      for (const zmena of zmeny) {
        for (const uzel of Array.from(zmena.addedNodes)) {
          if (!(uzel instanceof HTMLElement)) continue;
          if (uzel.matches(VYBER)) {
            for (const [jmeno, hodnota] of ATRIBUTY) uzel.setAttribute(jmeno, hodnota);
          }
          oznac(uzel);
        }
      }
    });
    sledovani.observe(document.body, { childList: true, subtree: true });
    return () => sledovani.disconnect();
  }, []);

  return null;
}
