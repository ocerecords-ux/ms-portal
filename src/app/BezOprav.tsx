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
 */
const ATRIBUTY: [string, string][] = [
  ['autocorrect', 'off'],
  ['autocapitalize', 'off'],
  ['spellcheck', 'false'],
];

function oznac(korenu: ParentNode) {
  const pole = korenu.querySelectorAll<HTMLElement>('input, textarea, [contenteditable="true"]');
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
          if (uzel.matches('input, textarea, [contenteditable="true"]')) {
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
