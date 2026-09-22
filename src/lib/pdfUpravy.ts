/**
 * ÚPRAVA PDF V PROHLÍŽEČI (zadání 22. 9. 2026: „když klient vloží text do
 * objednávky v PDF, bylo by dobré, kdyby se tam otevřel náhled a mohl ho
 * editovat a třeba mazat i jednotlivé stránky").
 *
 * Nový soubor skládá pdf-lib z CDN - stejně jako pdf.js (viz lib/pdfJs.ts),
 * žádná závislost v projektu navíc. Všechno běží u klienta, rukopis se nikam
 * neposílá dřív, než objednávku odešle.
 */

const ZDROJE = [
  'https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js',
  'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js',
];

/* eslint-disable @typescript-eslint/no-explicit-any */
let nacitani: Promise<any> | null = null;

function nactiSkript(adresa: string): Promise<void> {
  return new Promise((hotovo, chyba) => {
    const s = document.createElement('script');
    s.src = adresa;
    s.async = true;
    s.onload = () => hotovo();
    s.onerror = () => {
      s.remove();
      chyba(new Error(`Nepodařilo se načíst ${adresa}`));
    };
    document.head.appendChild(s);
  });
}

export function nactiPdfLib(): Promise<any> {
  const okno = window as unknown as { PDFLib?: any };
  if (okno.PDFLib) return Promise.resolve(okno.PDFLib);
  if (!nacitani) {
    nacitani = (async () => {
      for (const zdroj of ZDROJE) {
        try {
          await nactiSkript(zdroj);
          if (okno.PDFLib) return okno.PDFLib;
        } catch {
          // zkusí se další zdroj
        }
      }
      nacitani = null;
      throw new Error('Nástroj na úpravu PDF se nepodařilo načíst.');
    })();
  }
  return nacitani;
}

/** Jedna stránka výsledku: index v původním PDF (od 0) a otočení navíc (0/90/180/270). */
export type StrankaUpravy = { index: number; otoceni: number };

/** Složí nové PDF jen z vybraných stránek v daném pořadí. */
export async function slozUpravenePdf(puvodni: File, stranky: StrankaUpravy[]): Promise<File> {
  const PDFLib = await nactiPdfLib();
  const zdroj = await PDFLib.PDFDocument.load(await puvodni.arrayBuffer(), { ignoreEncryption: true });
  const novy = await PDFLib.PDFDocument.create();
  const zkopirovane = await novy.copyPages(
    zdroj,
    stranky.map((s) => s.index),
  );
  zkopirovane.forEach((stranka: any, i: number) => {
    const navic = stranky[i].otoceni % 360;
    if (navic) {
      const puvodniUhel = stranka.getRotation()?.angle ?? 0;
      stranka.setRotation(PDFLib.degrees((puvodniUhel + navic) % 360));
    }
    novy.addPage(stranka);
  });
  const bajty: Uint8Array = await novy.save();
  return new File([bajty as BlobPart], puvodni.name, { type: 'application/pdf', lastModified: Date.now() });
}
