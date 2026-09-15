import { deflateSync, inflateSync } from 'zlib';
import type { EmbeddedImage } from '@/lib/rodnyListAssets';

/**
 * ČTENÍ PNG ZA BĚHU (zadání 14. 9. 2026: podepsaná smlouva má chodit mailem
 * i jako PDF).
 *
 * Loga a razítko v Rodném listu jsou předpřipravená ve skriptu
 * scripts/build-rodny-list-assets.py, takže se nic dekódovat nemuselo.
 * Podpis ze smlouvy ale vzniká až v prohlížeči (canvas → data URL) a jinak
 * než rozbalením PNG se k pixelům nedostaneme.
 *
 * Proč vlastní čtečka a ne balíček: portál nemá žádnou závislost na práci
 * s obrázky a PNG z canvasu je vždycky ten nejjednodušší možný tvar -
 * 8 bitů na kanál, bez prokládání. Podporujeme proto jen tenhle tvar; co se
 * nepovede přečíst, vrátí null a PDF se vysází bez obrázku podpisu (údaje
 * z doložky zůstanou), místo aby celý mail spadl.
 */

type Hlavicka = {
  sirka: number;
  vyska: number;
  bitu: number;
  barevnost: number;
  prokladani: number;
};

const PODPIS_PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** Kolik kanálů má který typ barevnosti: šedá, RGB, šedá+alfa, RGBA. */
const KANALY: Record<number, number> = { 0: 1, 2: 3, 4: 2, 6: 4 };

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

/** Zruší řádkové filtry PNG. Vrací syrové pixely bez filtrovacích bajtů. */
function odfiltruj(data: Buffer, sirka: number, vyska: number, kanalu: number): Buffer {
  const radek = sirka * kanalu;
  const ven = Buffer.alloc(radek * vyska);
  let cti = 0;

  for (let y = 0; y < vyska; y++) {
    const filtr = data[cti++];
    const zac = y * radek;
    const predchozi = zac - radek;

    for (let i = 0; i < radek; i++) {
      const surovy = data[cti + i];
      const a = i >= kanalu ? ven[zac + i - kanalu] : 0;
      const b = y > 0 ? ven[predchozi + i] : 0;
      const c = y > 0 && i >= kanalu ? ven[predchozi + i - kanalu] : 0;

      let hodnota: number;
      switch (filtr) {
        case 0:
          hodnota = surovy;
          break;
        case 1:
          hodnota = surovy + a;
          break;
        case 2:
          hodnota = surovy + b;
          break;
        case 3:
          hodnota = surovy + ((a + b) >> 1);
          break;
        case 4:
          hodnota = surovy + paeth(a, b, c);
          break;
        default:
          throw new Error(`Neznámý filtr řádku ${filtr}.`);
      }
      ven[zac + i] = hodnota & 0xff;
    }
    cti += radek;
  }

  return ven;
}

/**
 * PNG (data URL nebo base64) → obrázek pro kreslitko: barva zvlášť, průhlednost
 * zvlášť, obojí zabalené deflatem, jak to chce PDF.
 */
export function dekodujPng(vstup: string | null | undefined): EmbeddedImage | null {
  try {
    if (!vstup) return null;
    const base64 = vstup.includes(',') ? vstup.slice(vstup.indexOf(',') + 1) : vstup;
    const buf = Buffer.from(base64, 'base64');
    if (buf.length < 8 || PODPIS_PNG.some((b, i) => buf[i] !== b)) return null;

    let hlavicka: Hlavicka | null = null;
    const casti: Buffer[] = [];
    let pozice = 8;

    while (pozice + 8 <= buf.length) {
      const delka = buf.readUInt32BE(pozice);
      const typ = buf.toString('latin1', pozice + 4, pozice + 8);
      const telo = buf.subarray(pozice + 8, pozice + 8 + delka);
      pozice += 12 + delka; // délka + typ + data + CRC

      if (typ === 'IHDR') {
        hlavicka = {
          sirka: telo.readUInt32BE(0),
          vyska: telo.readUInt32BE(4),
          bitu: telo[8],
          barevnost: telo[9],
          prokladani: telo[12],
        };
      } else if (typ === 'IDAT') {
        casti.push(telo);
      } else if (typ === 'IEND') {
        break;
      }
    }

    if (!hlavicka || casti.length === 0) return null;
    const { sirka, vyska, bitu, barevnost, prokladani } = hlavicka;
    if (bitu !== 8 || prokladani !== 0) return null;
    if (sirka <= 0 || vyska <= 0 || sirka * vyska > 8_000_000) return null;

    const kanalu = KANALY[barevnost];
    if (!kanalu) return null; // paleta (3) se v podpisu z canvasu neobjeví

    const pixely = odfiltruj(inflateSync(Buffer.concat(casti)), sirka, vyska, kanalu);

    const rgb = Buffer.alloc(sirka * vyska * 3);
    const alfa = Buffer.alloc(sirka * vyska);
    for (let i = 0; i < sirka * vyska; i++) {
      const z = i * kanalu;
      let r: number;
      let g: number;
      let b: number;
      let a = 255;
      if (kanalu === 1) {
        r = g = b = pixely[z];
      } else if (kanalu === 2) {
        r = g = b = pixely[z];
        a = pixely[z + 1];
      } else if (kanalu === 3) {
        [r, g, b] = [pixely[z], pixely[z + 1], pixely[z + 2]];
      } else {
        [r, g, b] = [pixely[z], pixely[z + 1], pixely[z + 2]];
        a = pixely[z + 3];
      }
      rgb[i * 3] = r;
      rgb[i * 3 + 1] = g;
      rgb[i * 3 + 2] = b;
      alfa[i] = a;
    }

    return {
      width: sirka,
      height: vyska,
      rgb: deflateSync(rgb, { level: 9 }).toString('base64'),
      alpha: deflateSync(alfa, { level: 9 }).toString('base64'),
    };
  } catch (err) {
    console.error('PNG se nepodařilo přečíst:', err);
    return null;
  }
}
