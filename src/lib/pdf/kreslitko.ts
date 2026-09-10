/**
 * Kreslitko PDF - spolecny zaklad pro vsechny dokumenty portalu.
 *
 * PROC VLASTNI ZAPISOVAC A NE KNIHOVNA: portal nema zadnou zavislost na
 * generovani PDF a pridavat kvuli par jednostrankovym dokumentum pdf-lib +
 * fontkit (a s nimi vlastni pisma na disku, ktera na Vercelu nemusi byt
 * dostupna) je vic rizika nez uzitku. Tady je presne to, co dokumenty
 * potrebuji: orezana pisma s ceskou diakritikou, obrazky s pruhlednosti,
 * plynuly prechod, zaoblene obdelniky a zalamani textu.
 *
 * Vzniklo to jako soucast Rodneho listu (9. 9. 2026) a vyclenilo se sem,
 * kdyz stejnou sazbu dostaly faktury a nabidky (zadani 10. 9. 2026).
 *
 * SOURADNICE se vsude pocitaji OD HORNIHO OKRAJE stranky (jako v grafickem
 * programu); do PDF, ktere meri zdola, je prepocitava Kresba.y().
 */

import { deflateSync } from 'zlib';
import type { EmbeddedFont, EmbeddedImage } from '@/lib/rodnyListAssets';

export type RGB = [number, number, number];

/** '#6B2AF0' -> [0.42, 0.16, 0.94] */
export function hex(value: string): RGB {
  const n = parseInt(value.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export const BILA: RGB = [1, 1, 1];

/** A4 na vysku, v bodech. */
export const A4 = { w: 595.28, h: 841.89 };

// --- Prace s pismem --------------------------------------------------------

/** Znak, ktery se pouzije misto glyfu, ktery orezane pismo nema. */
const FALLBACK_CHAR = '?';

function glyphOf(font: EmbeddedFont, ch: string): [number, number] {
  return font.glyphs[String(ch.codePointAt(0))] ?? font.glyphs[String(FALLBACK_CHAR.codePointAt(0))] ?? [0, 0];
}

/** Sirka textu v bodech pri dane velikosti pisma. */
export function textWidth(font: EmbeddedFont, text: string, size: number): number {
  let total = 0;
  for (const ch of text) total += glyphOf(font, ch)[1];
  return (total * size) / 1000;
}

/** Text zakodovany pro Identity-H - dvoubajtove indexy glyfu v hexu. */
function encodeText(font: EmbeddedFont, text: string): string {
  let out = '';
  for (const ch of text) {
    out += glyphOf(font, ch)[0].toString(16).padStart(4, '0').toUpperCase();
  }
  return out;
}

/** Vyska verzalek - podle ni se text svisle centruje v radku tabulky. */
export function capHeight(font: EmbeddedFont, size: number): number {
  return (font.capHeight * size) / 1000;
}

/**
 * Rozlomi hodnotu na radky tak, aby se vesla do sirky sloupce. Kdyz se
 * nevejde ani na dva radky, zmensi se pismo (dlouhe nazvy firem).
 */
export function fitValue(
  font: EmbeddedFont,
  text: string,
  maxWidth: number,
  size: number,
): { lines: string[]; size: number } {
  if (!text) return { lines: [''], size };
  if (textWidth(font, text, size) <= maxWidth) return { lines: [text], size };

  const words = text.split(/\s+/).filter(Boolean);
  for (let s = size; s >= 6.5; s -= 0.5) {
    const lines: string[] = [];
    let line = '';
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (textWidth(font, candidate, s) <= maxWidth || !line) {
        line = candidate;
      } else {
        lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
    if (lines.length <= 2 && lines.every((l) => textWidth(font, l, s) <= maxWidth)) {
      return { lines, size: s };
    }
  }
  // Posledni zachrana: tvrdy orez, at dokument vznikne i pri nesmyslne
  // dlouhem vstupu (nikdy nesmi spadnout kvuli delce nazvu).
  let cut = text;
  while (cut.length > 1 && textWidth(font, `${cut}…`, 6.5) > maxWidth) cut = cut.slice(0, -1);
  return { lines: [`${cut}…`], size: 6.5 };
}


// --- Minimalisticky zapisovac PDF -----------------------------------------

export class PdfWriter {
  private objects: (Buffer | null)[] = [null];

  add(body: Buffer | string): number {
    this.objects.push(typeof body === 'string' ? Buffer.from(body, 'latin1') : body);
    return this.objects.length - 1;
  }

  /** Zabere cislo objektu dopredu - kvuli krizovym odkazum (stranka <-> strom stranek). */
  reserve(): number {
    this.objects.push(Buffer.alloc(0));
    return this.objects.length - 1;
  }

  fill(id: number, body: Buffer | string) {
    this.objects[id] = typeof body === 'string' ? Buffer.from(body, 'latin1') : body;
  }

  /** Proud dat s vlastnim slovnikem; delka se doplni sama. */
  addStream(dict: string, data: Buffer): number {
    const head = Buffer.from(`<< ${dict} /Length ${data.length} >>\nstream\n`, 'latin1');
    const tail = Buffer.from('\nendstream', 'latin1');
    return this.add(Buffer.concat([head, data, tail]));
  }

  build(rootId: number, infoId?: number): Buffer {
    const parts: Buffer[] = [Buffer.from('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n', 'latin1')];
    const offsets: number[] = [0];
    let position = parts[0].length;

    for (let i = 1; i < this.objects.length; i++) {
      const body = this.objects[i]!;
      const chunk = Buffer.concat([
        Buffer.from(`${i} 0 obj\n`, 'latin1'),
        body,
        Buffer.from('\nendobj\n', 'latin1'),
      ]);
      offsets[i] = position;
      position += chunk.length;
      parts.push(chunk);
    }

    const count = this.objects.length;
    let xref = `xref\n0 ${count}\n0000000000 65535 f \n`;
    for (let i = 1; i < count; i++) xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
    const info = infoId ? ` /Info ${infoId} 0 R` : '';
    xref += `trailer\n<< /Size ${count} /Root ${rootId} 0 R${info} >>\nstartxref\n${position}\n%%EOF\n`;
    parts.push(Buffer.from(xref, 'latin1'));

    return Buffer.concat(parts);
  }
}

/**
 * Retezec do PDF v UTF-16BE (hexem). Jednoduche zavorkove retezce umi jen
 * latin1, takze by v nazvu dokumentu zmizela cestina.
 */
export function pdfText(value: string): string {
  const utf16 = Buffer.from(`﻿${value}`, 'utf16le').swap16();
  return `<${utf16.toString('hex').toUpperCase()}>`;
}

/**
 * Vlozi orezane TrueType pismo jako Type0 / Identity-H. Diky tomu umi
 * dokument cestinu bez ohledu na to, co ma ctecka nainstalovane.
 */
export function embedFont(pdf: PdfWriter, font: EmbeddedFont, baseName: string): number {
  const ttf = Buffer.from(font.ttf, 'base64');
  const packed = deflateSync(ttf, { level: 9 });
  const fileId = pdf.addStream(`/Length1 ${ttf.length} /Filter /FlateDecode`, packed);

  const descriptorId = pdf.add(
    `<< /Type /FontDescriptor /FontName /${baseName} /Flags 32 ` +
      `/FontBBox [${font.bbox.join(' ')}] /ItalicAngle 0 /Ascent ${font.ascent} ` +
      `/Descent ${font.descent} /CapHeight ${font.capHeight} /StemV 80 /FontFile2 ${fileId} 0 R >>`,
  );

  const entries = Object.entries(font.glyphs)
    .map(([code, [gid, width]]) => ({ code: Number(code), gid, width }))
    .sort((a, b) => a.gid - b.gid);

  const widths = entries.map((e) => `${e.gid} [${e.width}]`).join(' ');
  const cidId = pdf.add(
    `<< /Type /Font /Subtype /CIDFontType2 /BaseFont /${baseName} ` +
      `/CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> ` +
      `/FontDescriptor ${descriptorId} 0 R /DW 1000 /W [${widths}] /CIDToGIDMap /Identity >>`,
  );

  // ToUnicode - aby sel text z hotoveho PDF kopirovat a hledat.
  const bf = entries
    .map((e) => `<${e.gid.toString(16).padStart(4, '0')}> <${e.code.toString(16).padStart(4, '0')}>`)
    .join('\n');
  const toUnicode =
    '/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n' +
    '/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def\n' +
    '/CMapName /Adobe-Identity-UCS def\n/CMapType 2 def\n' +
    '1 begincodespacerange\n<0000> <FFFF>\nendcodespacerange\n' +
    chunk(bf.split('\n'), 100)
      .map((group) => `${group.length} beginbfchar\n${group.join('\n')}\nendbfchar`)
      .join('\n') +
    '\nendcmap\nCMapName currentdict /CMap defineresource pop\nend\nend';
  const toUnicodeId = pdf.addStream('/Filter /FlateDecode', deflateSync(Buffer.from(toUnicode, 'utf-8'), { level: 9 }));

  return pdf.add(
    `<< /Type /Font /Subtype /Type0 /BaseFont /${baseName} /Encoding /Identity-H ` +
      `/DescendantFonts [${cidId} 0 R] /ToUnicode ${toUnicodeId} 0 R >>`,
  );
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Obrazek s pruhlednosti - barva jako DeviceRGB, alfa jako SMask. */
export function embedImage(pdf: PdfWriter, image: EmbeddedImage): number {
  const smaskId = pdf.addStream(
    `/Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} ` +
      '/ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode',
    Buffer.from(image.alpha, 'base64'),
  );
  return pdf.addStream(
    `/Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} ` +
      `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /SMask ${smaskId} 0 R`,
    Buffer.from(image.rgb, 'base64'),
  );
}


// --- Kresleni --------------------------------------------------------------

export class Kresba {
  private ops: string[] = [];

  /**
   * Vyska stranky v bodech. Souradnice se zvenku zadavaji od HORNIHO okraje,
   * PDF ale meri zdola - prepocet dela y().
   */
  private readonly vyskaStranky: number;

  constructor(vyskaStranky: number = A4.h) {
    this.vyskaStranky = vyskaStranky;
  }

  private y(odshora: number): number {
    return this.vyskaStranky - odshora;
  }

  fillRect(x: number, top: number, w: number, h: number, color: RGB) {
    this.ops.push(`${color.join(' ')} rg ${f(x)} ${f(this.y(top + h))} ${f(w)} ${f(h)} re f`);
  }

  line(x1: number, top1: number, x2: number, top2: number, color: RGB, width: number) {
    this.ops.push(
      `${color.join(' ')} RG ${f(width)} w ${f(x1)} ${f(this.y(top1))} m ${f(x2)} ${f(this.y(top2))} l S`,
    );
  }

  /**
   * Cesta zaobleneho obdelniku. Horni a dolni rohy maji vlastni polomer -
   * hlavicka je zaoblena jen nahore a dole navazuje na bilou kartu.
   */
  private roundPath(x: number, top: number, w: number, h: number, rTop: number, rBottom: number): string {
    const yb = this.y(top + h);
    const yt = this.y(top);
    const x0 = x;
    const x1 = x + w;
    const kt = rTop * 0.5523;
    const kb = rBottom * 0.5523;
    return [
      `${f(x0 + rBottom)} ${f(yb)} m`,
      `${f(x1 - rBottom)} ${f(yb)} l`,
      `${f(x1 - rBottom + kb)} ${f(yb)} ${f(x1)} ${f(yb + rBottom - kb)} ${f(x1)} ${f(yb + rBottom)} c`,
      `${f(x1)} ${f(yt - rTop)} l`,
      `${f(x1)} ${f(yt - rTop + kt)} ${f(x1 - rTop + kt)} ${f(yt)} ${f(x1 - rTop)} ${f(yt)} c`,
      `${f(x0 + rTop)} ${f(yt)} l`,
      `${f(x0 + rTop - kt)} ${f(yt)} ${f(x0)} ${f(yt - rTop + kt)} ${f(x0)} ${f(yt - rTop)} c`,
      `${f(x0)} ${f(yb + rBottom)} l`,
      `${f(x0)} ${f(yb + rBottom - kb)} ${f(x0 + rBottom - kb)} ${f(yb)} ${f(x0 + rBottom)} ${f(yb)} c`,
      'h',
    ].join(' ');
  }

  fillRound(x: number, top: number, w: number, h: number, rTop: number, rBottom: number, color: RGB) {
    this.ops.push(`${color.join(' ')} rg ${this.roundPath(x, top, w, h, rTop, rBottom)} f`);
  }

  strokeRound(
    x: number,
    top: number,
    w: number,
    h: number,
    rTop: number,
    rBottom: number,
    color: RGB,
    width: number,
  ) {
    this.ops.push(
      `${color.join(' ')} RG ${f(width)} w ${this.roundPath(x, top, w, h, rTop, rBottom)} S`,
    );
  }

  /** Orizne kresleni na zablony tvar (pouziva se u tabulky a hlavicky). */
  clipRound(x: number, top: number, w: number, h: number, rTop: number, rBottom: number) {
    this.ops.push(`q ${this.roundPath(x, top, w, h, rTop, rBottom)} W n`);
  }

  /** Vyplni aktualni orez plynulym prechodem (viz /Shading v prostredcich stranky). */
  shade(name: string) {
    this.ops.push(`/${name} sh`);
  }

  pop() {
    this.ops.push('Q');
  }

  text(
    font: EmbeddedFont,
    name: string,
    value: string,
    size: number,
    x: number,
    baselineTop: number,
    color: RGB,
    spacing = 0,
  ) {
    if (!value) return;
    this.ops.push(
      `BT /${name} ${f(size)} Tf ${f(spacing)} Tc ${color.join(' ')} rg ` +
        `1 0 0 1 ${f(x)} ${f(this.y(baselineTop))} Tm <${encodeText(font, value)}> Tj ET`,
    );
  }

  image(name: string, x: number, top: number, w: number, h: number) {
    this.ops.push(`q ${f(w)} 0 0 ${f(h)} ${f(x)} ${f(this.y(top + h))} cm /${name} Do Q`);
  }

  toBuffer(): Buffer {
    return Buffer.from(this.ops.join('\n'), 'latin1');
  }
}

/** Cisla v PDF bez zbytecnych desetinnych mist. */
export function f(value: number): string {
  return Number(value.toFixed(3)).toString();
}

