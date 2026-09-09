import { deflateSync } from 'zlib';
import {
  FONT_BOLD,
  FONT_REGULAR,
  LOGO,
  SIGNATURE,
  type EmbeddedFont,
  type EmbeddedImage,
} from '@/lib/rodnyListAssets';

/**
 * Vykresleni Rodneho listu (RL) do PDF - zadani 9. 9. 2026.
 *
 * PROC VLASTNI ZAPISOVAC PDF A NE KNIHOVNA:
 * portal nema zadnou zavislost na generovani PDF a pridavat kvuli jednomu
 * jednostrankovemu dokumentu pdf-lib + fontkit (a s nimi vlastni pisma na
 * disku, ktera na Vercelu nemusi byt dostupna) je vic rizika nez uzitku.
 * Dokument ma pevne rozlozeni podle vzoru "RL_Dobre podlahy.pdf", takze staci
 * napsat presne ty objekty, ktere potrebuje: dve orezana pisma, dva obrazky
 * a jeden obsahovy proud. Vsechno je otestovatelne bez site.
 *
 * ROZLOZENI je odmerene primo ze vzoroveho PDF (souradnice, velikosti pisma,
 * barvy i tloustky car) - viz konstanty nize. Souradnice se tu vsude pocitaji
 * OD HORNIHO OKRAJE stranky (jako v grafickem programu); do PDF, ktere meri
 * zdola, je prepocitava funkce y().
 */

// --- Stranka a rozlozeni (vse v bodech, mereno od horniho okraje) ----------

const PAGE_W = 595.28; // A4
const PAGE_H = 841.89;

/** Fialovy pruh pres celou sirku - #9900FF, vytazeno ze vzoru. */
const BAR_COLOR: RGB = [153 / 255, 0, 1];
const BAR_HEIGHT = 86;

const LOGO_BOX = { x: 388.6, y: 19.0, w: 151.5, h: 50.6 };

const TITLE = 'RODNÝ LIST';
const TITLE_SIZE = 16;
const TITLE_CENTER_X = 296.0;
const TITLE_BASELINE = 48.2;

/** Tabulka: leva hrana, delici cara sloupcu, prava hrana. */
const TABLE_LEFT = 56.5;
const TABLE_SPLIT = 223.5;
const TABLE_RIGHT = 538.5;
/** Vodorovne cary tabulky - prvni radek je ve vzoru vyssi nez ostatni. */
const TABLE_LINES = [131.5, 208.5, 265.5, 322.5, 379.5, 436.5, 493.5, 550.5];
const TABLE_LINE_WIDTH = 1;

const CELL_SIZE = 10;
const LABEL_CENTER_X = (TABLE_LEFT + TABLE_SPLIT) / 2;
const VALUE_CENTER_X = (TABLE_SPLIT + TABLE_RIGHT) / 2;
/** Kolik mista v pravem sloupci smi hodnota zabrat, nez se zalomi/zmensi. */
const VALUE_MAX_WIDTH = TABLE_RIGHT - TABLE_SPLIT - 24;

const PRODUCED_BY = 'Vyrobila společnost MEDIA SPACE s.r.o.';
const PRODUCED_SIZE = 11;
const PRODUCED_X = 60.4;
const PRODUCED_BASELINE = 645.9;

/** Ramecek podpisu je ve vzoru vyrazne silnejsi nez mrizka tabulky. */
const SIGN_BOX_LINE_WIDTH = 1.5;
const SIGN_BOX = { x: 337.2, y: 631.56, w: 195.75, h: 81.75 };
const SIGN_LABEL = 'PODPIS:';
const SIGN_LABEL_SIZE = 10.5;
const SIGN_LABEL_X = 341.7;
const SIGN_IMAGE = { x: 403.1, y: 646.2, w: 93.7, h: 41.5 };

const FOOTER_PARTS = ['MEDIA SPACE s.r.o. | ', 'www.mediaspace.cz', ' | ', 'info@mediaspace.cz'];
/** Ktere casti paticky jsou podtrzene (odkazy) - podle vzoru. */
const FOOTER_UNDERLINED = [false, true, false, true];
const FOOTER_SIZE = 11;
const FOOTER_CENTER_X = 305.0;
const FOOTER_BASELINE = 735.5;

const BLACK: RGB = [0, 0, 0];
const WHITE: RGB = [1, 1, 1];

type RGB = [number, number, number];

/** Prevod z "od horniho okraje" na souradnici PDF (od spodniho okraje). */
function y(fromTop: number): number {
  return PAGE_H - fromTop;
}

// --- Data dokumentu --------------------------------------------------------

export type RodnyListData = {
  clientName: string;
  spotName: string;
  spotLength: string;
  director: string;
  musicTitle: string;
  musicAuthor: string;
  /** Uz naformatovane datum, napr. "24.08.2026". */
  productionDate: string;
};

/** Radky tabulky v poradi podle vzoru. */
export function rodnyListRows(data: RodnyListData): { label: string; value: string }[] {
  return [
    { label: 'NÁZEV KLIENTA', value: data.clientName },
    { label: 'NÁZEV SPOTU', value: data.spotName },
    { label: 'DÉLKA', value: data.spotLength },
    { label: 'REŽIE', value: data.director },
    { label: 'NÁZEV HUDBY', value: data.musicTitle },
    { label: 'AUTOR HUDBY', value: data.musicAuthor },
    { label: 'DATUM VÝROBY', value: data.productionDate },
  ];
}

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
function capHeight(font: EmbeddedFont, size: number): number {
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

class PdfWriter {
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
function pdfText(value: string): string {
  const utf16 = Buffer.from(`﻿${value}`, 'utf16le').swap16();
  return `<${utf16.toString('hex').toUpperCase()}>`;
}

/**
 * Vlozi orezane TrueType pismo jako Type0 / Identity-H. Diky tomu umi
 * dokument cestinu bez ohledu na to, co ma ctecka nainstalovane.
 */
function embedFont(pdf: PdfWriter, font: EmbeddedFont, baseName: string): number {
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
function embedImage(pdf: PdfWriter, image: EmbeddedImage): number {
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

// --- Vlastni vykresleni ----------------------------------------------------

class Content {
  private ops: string[] = [];

  fillRect(x: number, top: number, w: number, h: number, color: RGB) {
    this.ops.push(`${color.join(' ')} rg ${f(x)} ${f(y(top + h))} ${f(w)} ${f(h)} re f`);
  }

  strokeRect(x: number, top: number, w: number, h: number, color: RGB, width: number) {
    this.ops.push(
      `${color.join(' ')} RG ${f(width)} w ${f(x)} ${f(y(top + h))} ${f(w)} ${f(h)} re S`,
    );
  }

  line(x1: number, top1: number, x2: number, top2: number, color: RGB, width: number) {
    this.ops.push(
      `${color.join(' ')} RG ${f(width)} w ${f(x1)} ${f(y(top1))} m ${f(x2)} ${f(y(top2))} l S`,
    );
  }

  text(font: EmbeddedFont, name: string, value: string, size: number, x: number, baselineTop: number, color: RGB) {
    if (!value) return;
    this.ops.push(
      `BT /${name} ${f(size)} Tf ${color.join(' ')} rg 1 0 0 1 ${f(x)} ${f(y(baselineTop))} Tm ` +
        `<${encodeText(font, value)}> Tj ET`,
    );
  }

  textCentered(
    font: EmbeddedFont,
    name: string,
    value: string,
    size: number,
    centerX: number,
    baselineTop: number,
    color: RGB,
  ) {
    this.text(font, name, value, size, centerX - textWidth(font, value, size) / 2, baselineTop, color);
  }

  image(name: string, x: number, top: number, w: number, h: number) {
    this.ops.push(`q ${f(w)} 0 0 ${f(h)} ${f(x)} ${f(y(top + h))} cm /${name} Do Q`);
  }

  toBuffer(): Buffer {
    return Buffer.from(this.ops.join('\n'), 'latin1');
  }
}

/** Cisla v PDF bez zbytecnych desetinnych mist. */
function f(value: number): string {
  return Number(value.toFixed(3)).toString();
}

/**
 * Vyrobi hotove jednostrankove PDF Rodneho listu.
 *
 * Nikdy nevyhazuje kvuli obsahu dat - prilis dlouhe hodnoty se zalomi nebo
 * zmensi (viz fitValue), protoze dokument vznika automaticky pri zmene stavu
 * projektu a nesmi to shodit celou akci.
 */
export function renderRodnyListPdf(data: RodnyListData): Buffer {
  const pdf = new PdfWriter();

  const regularId = embedFont(pdf, FONT_REGULAR, 'LiberationSans');
  const boldId = embedFont(pdf, FONT_BOLD, 'LiberationSans-Bold');
  const logoId = embedImage(pdf, LOGO);
  const signatureId = embedImage(pdf, SIGNATURE);

  const c = new Content();

  // 1) Fialovy pruh, logo a nadpis.
  c.fillRect(0, 0, PAGE_W, BAR_HEIGHT, BAR_COLOR);
  c.image('ImLogo', LOGO_BOX.x, LOGO_BOX.y, LOGO_BOX.w, LOGO_BOX.h);
  c.textCentered(FONT_BOLD, 'FB', TITLE, TITLE_SIZE, TITLE_CENTER_X, TITLE_BASELINE, WHITE);

  // 2) Mrizka tabulky - vodorovne cary pres celou sirku, tri svisle.
  for (const lineTop of TABLE_LINES) {
    c.line(TABLE_LEFT, lineTop, TABLE_RIGHT, lineTop, BLACK, TABLE_LINE_WIDTH);
  }
  const gridTop = TABLE_LINES[0];
  const gridBottom = TABLE_LINES[TABLE_LINES.length - 1];
  for (const x of [TABLE_LEFT, TABLE_SPLIT, TABLE_RIGHT]) {
    c.line(x, gridTop, x, gridBottom, BLACK, TABLE_LINE_WIDTH);
  }

  // 3) Obsah bunek. Popisek i hodnota se svisle centruji podle vysky verzalek,
  //    stejne jako ve vzoru.
  rodnyListRows(data).forEach((row, index) => {
    const rowTop = TABLE_LINES[index];
    const rowBottom = TABLE_LINES[index + 1];
    const center = (rowTop + rowBottom) / 2;

    c.textCentered(
      FONT_BOLD,
      'FB',
      row.label,
      CELL_SIZE,
      LABEL_CENTER_X,
      center + capHeight(FONT_BOLD, CELL_SIZE) / 2,
      BLACK,
    );

    const fitted = fitValue(FONT_REGULAR, row.value, VALUE_MAX_WIDTH, CELL_SIZE);
    const lineHeight = fitted.size * 1.25;
    const blockTop = center - ((fitted.lines.length - 1) * lineHeight) / 2;
    fitted.lines.forEach((line, i) => {
      c.textCentered(
        FONT_REGULAR,
        'FR',
        line,
        fitted.size,
        VALUE_CENTER_X,
        blockTop + i * lineHeight + capHeight(FONT_REGULAR, fitted.size) / 2,
        BLACK,
      );
    });
  });

  // 4) Podpisova cast.
  c.text(FONT_BOLD, 'FB', PRODUCED_BY, PRODUCED_SIZE, PRODUCED_X, PRODUCED_BASELINE, BLACK);
  c.strokeRect(SIGN_BOX.x, SIGN_BOX.y, SIGN_BOX.w, SIGN_BOX.h, BLACK, SIGN_BOX_LINE_WIDTH);
  c.text(FONT_BOLD, 'FB', SIGN_LABEL, SIGN_LABEL_SIZE, SIGN_LABEL_X, PRODUCED_BASELINE, BLACK);
  c.image('ImSign', SIGN_IMAGE.x, SIGN_IMAGE.y, SIGN_IMAGE.w, SIGN_IMAGE.h);

  // 5) Paticka - dva odkazy jsou podtrzene, stejne jako ve vzoru.
  const footerWidth = FOOTER_PARTS.reduce((sum, part) => sum + textWidth(FONT_REGULAR, part, FOOTER_SIZE), 0);
  let cursor = FOOTER_CENTER_X - footerWidth / 2;
  FOOTER_PARTS.forEach((part, i) => {
    const width = textWidth(FONT_REGULAR, part, FOOTER_SIZE);
    c.text(FONT_REGULAR, 'FR', part, FOOTER_SIZE, cursor, FOOTER_BASELINE, BLACK);
    if (FOOTER_UNDERLINED[i]) {
      c.line(cursor, FOOTER_BASELINE + 1.4, cursor + width, FOOTER_BASELINE + 1.4, BLACK, 0.6);
    }
    cursor += width;
  });

  // 6) Slozeni dokumentu.
  const contentId = pdf.addStream('/Filter /FlateDecode', deflateSync(c.toBuffer(), { level: 9 }));
  const pagesId = pdf.reserve();
  const pageId = pdf.add(
    `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${f(PAGE_W)} ${f(PAGE_H)}] ` +
      `/Resources << /Font << /FR ${regularId} 0 R /FB ${boldId} 0 R >> ` +
      `/XObject << /ImLogo ${logoId} 0 R /ImSign ${signatureId} 0 R >> >> ` +
      `/Contents ${contentId} 0 R >>`,
  );
  pdf.fill(pagesId, `<< /Type /Pages /Kids [${pageId} 0 R] /Count 1 >>`);
  const infoId = pdf.add(
    `<< /Title ${pdfText(`Rodný list – ${data.spotName}`.replace(/[\r\n]+/g, ' '))} ` +
      `/Producer ${pdfText('MS Portal')} >>`,
  );
  const rootId = pdf.add(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);

  return pdf.build(rootId, infoId);
}
