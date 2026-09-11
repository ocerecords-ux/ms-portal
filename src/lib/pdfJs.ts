/**
 * Načtení pdf.js z CDN — sdílené pro celý portál.
 *
 * Schválně to NENÍ `import('https://…')`: takový import se snaží přeložit
 * balíčkovač i TypeScript a ani jeden vzdálenou adresu neumí. Modul se proto
 * vkládá jako obyčejný `<script type="module">`, který si hotovou knihovnu
 * odloží na `window`. Načte se jen jednou za život stránky, ať se o něj
 * přeposlech i počítání normostran dělí.
 */

export const PDFJS_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/6.3.289';

/* eslint-disable @typescript-eslint/no-explicit-any */
export function nactiPdfJs(): Promise<any> {
  const okno = window as unknown as { __pdfjs?: any; __pdfjsSlib?: Promise<any> };
  if (okno.__pdfjs) return Promise.resolve(okno.__pdfjs);
  // Dva soubory naráz (nebo přeposlech vedle objednávky) nesmí vložit skript
  // dvakrát - druhý by čekal na událost, která už proběhla.
  if (okno.__pdfjsSlib) return okno.__pdfjsSlib;

  const slib = new Promise<any>((hotovo, chyba) => {
    const hlaska = 'portal-pdfjs';
    window.addEventListener(
      hlaska,
      (e: Event) => {
        const detail = (e as CustomEvent<{ ok: boolean }>).detail;
        if (detail?.ok && okno.__pdfjs) hotovo(okno.__pdfjs);
        else chyba(new Error('pdf.js se nepodařilo načíst'));
      },
      { once: true },
    );

    const script = document.createElement('script');
    script.type = 'module';
    script.textContent =
      `import * as pdfjs from "${PDFJS_CDN}/pdf.min.mjs";\n` +
      `window.__pdfjs = pdfjs;\n` +
      `window.dispatchEvent(new CustomEvent("${hlaska}", { detail: { ok: true } }));`;
    script.onerror = () => window.dispatchEvent(new CustomEvent(hlaska, { detail: { ok: false } }));
    document.head.appendChild(script);
  });

  okno.__pdfjsSlib = slib;
  return slib;
}
