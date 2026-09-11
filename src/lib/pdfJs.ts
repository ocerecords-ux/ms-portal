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

  /**
   * SAFARI NEUMÍ PROJÍT STREAM CYKLEM `for await` (stav k 12. 9. 2026,
   * Safari 26). A přesně to dělá pdf.js v `getTextContent()`, ze kterého
   * čteme text stránky — jak v počítadle normostran, tak v AudioTaggeru pod
   * nahrávkou. Safari na tom spadne hláškou „undefined is not a function
   * (near '...t of e...')", ze které nikoho nenapadne, že jde o tohle.
   *
   * Doplňujeme tedy streamu chybějící schopnost. Je to přesně to, co dělá
   * norma: čtečka se otevře, čte se po kusech a na konci se zavře.
   */
  const RS = typeof ReadableStream !== 'undefined' ? (ReadableStream.prototype as any) : null;
  if (RS && !RS[Symbol.asyncIterator]) {
    RS[Symbol.asyncIterator] = function ({ preventCancel = false } = {}) {
      const ctecka = this.getReader();
      return {
        async next() {
          try {
            const kus = await ctecka.read();
            if (kus.done) ctecka.releaseLock();
            return kus;
          } catch (err) {
            ctecka.releaseLock();
            throw err;
          }
        },
        async return(hodnota: unknown) {
          if (preventCancel) {
            ctecka.releaseLock();
          } else {
            const hotovo = ctecka.cancel(hodnota);
            ctecka.releaseLock();
            await hotovo;
          }
          return { done: true, value: hodnota };
        },
        [Symbol.asyncIterator]() {
          return this;
        },
      };
    };
    RS.values = RS[Symbol.asyncIterator];
  }

  /**
   * Starší Safari (do 17.4) neumí `Promise.withResolvers`, které pdf.js 6
   * používá. Bez tohohle doplnění spadne rovnou při načtení hláškou
   * „undefined is not a function" a nikdo se nedopátrá proč (12. 9. 2026).
   */
  const P = Promise as unknown as { withResolvers?: unknown };
  if (typeof P.withResolvers !== 'function') {
    P.withResolvers = function withResolvers<T>() {
      let resolve!: (v: T | PromiseLike<T>) => void;
      let reject!: (d?: unknown) => void;
      const promise = new Promise<T>((a, b) => {
        resolve = a;
        reject = b;
      });
      return { promise, resolve, reject };
    };
  }

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

/**
 * Nastavi pdf.js pomocny vlaknový skript (worker) tak, aby fungoval i v Safari.
 *
 * PROC TO NENI JEN JEDEN RADEK: pdf.js si worker pousti z adresy, kterou mu
 * dame - a ta vede na CDN, tedy na CIZI DOMENU. Chrome si s tim poradi,
 * Safari vlakno z ciziho serveru odmitne spustit a pdf.js pak spadne
 * v nitru knihovny na neprehledne „undefined is not a function"
 * (12. 9. 2026, Safari 26: „u objednavky nefunguje porad to pocitadlo").
 *
 * Skript se proto nejdriv stahne k nam a teprve z nej vznikne adresa
 * `blob:`, ktera uz se tvari jako z vlastni domeny. Stahuje se jednou za
 * zivot stranky.
 *
 * Kdyz se nepovede ani to, worker se nenastavi a pdf.js si poradi sam na
 * hlavnim vlakne - pomaleji, ale poradi.
 */
let workerAdresa: Promise<string | null> | null = null;

export async function nastavPdfWorker(pdfjs: any): Promise<void> {
  if (pdfjs?.GlobalWorkerOptions?.workerSrc) return;

  if (!workerAdresa) {
    workerAdresa = fetch(`${PDFJS_CDN}/pdf.worker.min.mjs`)
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))))
      .then((kod) => URL.createObjectURL(new Blob([kod], { type: 'text/javascript' })))
      .catch((err) => {
        console.warn('pdf.js: worker se nepodarilo pripravit, pojede to na hlavnim vlakne', err);
        return null;
      });
  }

  const adresa = await workerAdresa;
  if (adresa) pdfjs.GlobalWorkerOptions.workerSrc = adresa;
}
