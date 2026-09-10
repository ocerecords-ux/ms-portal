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
 * Dokument ma pevne rozlozeni, takze staci napsat presne ty objekty, ktere
 * potrebuje: dve orezana pisma, dva obrazky, jeden prechod a jeden obsahovy
 * proud. Vsechno je otestovatelne bez site.
 *
 * GRAFIKA (zadani 10. 9. 2026: "vic vyraznych barev, jako ty notifikace nebo
 * pozvanka do portalu"): dokument uz nekopiruje puvodni cernou mrizku ze
 * vzoru "RL_Dobre podlahy.pdf", ale drzi stejnou vizualni rec jako nase
 * e-maily - bila karta se zaoblenymi rohy, fialovy gradient v hlavicce se
 * zelenym prouzkem, nazev spotu jako nadpis, tabulka udaju se svetle
 * fialovym sloupcem popisku a mentolovy blok s hudbou. Barvy jsou doslova ty
 * z emailShell() v src/lib/email.ts - kdyz se zmeni tam, patri zmenit i tady.
 *
 * SOURADNICE se tu vsude pocitaji OD HORNIHO OKRAJE stranky (jako v grafickem
 * programu); do PDF, ktere meri zdola, je prepocitava funkce y().
 */

// --- Barvy a rozlozeni (vse v bodech, mereno od horniho okraje) ------------

const PAGE_W = 595.28; // A4
const PAGE_H = 841.89;

type RGB = [number, number, number];

/** '#6B2AF0' -> [0.42, 0.16, 0.94] */
function hex(value: string): RGB {
  const n = parseInt(value.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/*
 * PALETA je presne ta, kterou mluvi nase e-maily (viz emailShell v
 * src/lib/email.ts): fialovy gradient v hlavicce, zeleny akcent, mentolova
 * plocha, svetle fialove popisky. Rodny list ma pusobit jako dalsi kus te
 * same identity - ne jako formular z jineho sveta.
 */
const PURPLE = hex('#6B2AF0');
const PURPLE_LIGHT = hex('#7B55FF');
const GREEN = hex('#1FDF67');
const GREEN_DARK = hex('#149E4B');
const MINT_BG = hex('#E9FFF2');
const INK = hex('#201A33');
const MUTED = hex('#6E6580');
const BORDER = hex('#E4DFFB');
const LABEL_BG = hex('#F7F5FF');
const PAGE_BG = hex('#FBFAFF');
const WHITE: RGB = [1, 1, 1];

// Bila karta uprostred stranky - stejny tvar jako karta v e-mailu.
const CARD = { x: 42, top: 42, w: 511.28, h: 758, r: 16 };
const PAD = 34; // vnitrni okraj karty
const LEFT = CARD.x + PAD;
const RIGHT = CARD.x + CARD.w - PAD;
const INNER_W = RIGHT - LEFT;

// Hlavicka s fialovym gradientem. Je to dokument Mediaspace, ne portalu -
// proto tu je jen logo MEDIASPACE a nazev dokumentu (zadani 10. 9. 2026).
const HERO_H = 158;
const HERO_BOTTOM = CARD.top + HERO_H;
const LOGO_H = 32;
const LOGO_TOP = 68;
const TITLE = 'RODNÝ LIST';
const TITLE_SIZE = 30;
const TITLE_BASELINE = 168;
const GREEN_BAR = { top: 124, w: 46, h: 3 };

// Tabulka udaju - stejna sazba jako .field-table v e-mailu.
const TABLE_TOP = 232;
const ROW_H = 46;
const LABEL_W = 160;
const SPLIT = LEFT + LABEL_W;
const CELL_PAD = 16;
const TABLE_R = 12;
const LABEL_SIZE = 8.5;
const LABEL_SPACING = 0.7;
const VALUE_SIZE = 11.5;
const VALUE_MAX_W = RIGHT - CELL_PAD - (SPLIT + CELL_PAD);

// Mentolovy blok s hudbou.
const MUSIC = { top: 486, h: 92, r: 12 };
const MUSIC_HEAD_BASELINE = 514;
const MUSIC_LABEL_BASELINE = 536;
const MUSIC_VALUE_BASELINE = 556;
const MUSIC_COL2 = LEFT + 234;

// Podpisova cast.
const PRODUCED_BY = 'Vyrobila společnost MEDIA SPACE s.r.o.';
const PRODUCED_SIZE = 11;
const PRODUCED_BASELINE = 650;
const SIGN_BOX = { x: 330, top: 628, w: RIGHT - 330, h: 92, r: 12 };
const SIGN_LABEL = 'PODPIS';
const SIGN_LABEL_SIZE = 8;
const SIGN_IMAGE_W = 112;

// Paticka.
const FOOTER_RULE_TOP = 756;
const FOOTER_BASELINE = 780;
const FOOTER_SIZE = 9.5;

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

  line(x1: number, top1: number, x2: number, top2: number, color: RGB, width: number) {
    this.ops.push(
      `${color.join(' ')} RG ${f(width)} w ${f(x1)} ${f(y(top1))} m ${f(x2)} ${f(y(top2))} l S`,
    );
  }

  /**
   * Cesta zaobleneho obdelniku. Horni a dolni rohy maji vlastni polomer -
   * hlavicka je zaoblena jen nahore a dole navazuje na bilou kartu.
   */
  private roundPath(x: number, top: number, w: number, h: number, rTop: number, rBottom: number): string {
    const yb = y(top + h);
    const yt = y(top);
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
        `1 0 0 1 ${f(x)} ${f(y(baselineTop))} Tm <${encodeText(font, value)}> Tj ET`,
    );
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

/** Paticka: nazev firmy tucne, kontakty ve fialove - stejne jako v e-mailu. */
const FOOTER_PARTS: { text: string; color: RGB; bold?: boolean }[] = [
  { text: 'MEDIA SPACE s.r.o.', color: INK, bold: true },
  { text: '   •   ', color: MUTED },
  { text: 'www.mediaspace.cz', color: PURPLE },
  { text: '   •   ', color: MUTED },
  { text: 'info@mediaspace.cz', color: PURPLE },
];

/**
 * Vyrobi hotove jednostrankove PDF Rodneho listu.
 *
 * Nikdy nevyhazuje kvuli obsahu dat - prilis dlouhe hodnoty se zalomi nebo
 * zmensi (viz fitValue), protoze dokument muze vznikat automaticky pri zmene
 * stavu projektu a nesmi to shodit celou akci.
 */
export function renderRodnyListPdf(data: RodnyListData): Buffer {
  const pdf = new PdfWriter();

  const regularId = embedFont(pdf, FONT_REGULAR, 'LiberationSans');
  const boldId = embedFont(pdf, FONT_BOLD, 'LiberationSans-Bold');
  const logoId = embedImage(pdf, LOGO);
  const signatureId = embedImage(pdf, SIGNATURE);

  // Prechod v hlavicce vede z leveho horniho do praveho dolniho rohu - tedy
  // tech 135 stupnu, ktere ma linear-gradient v e-mailove sablone.
  const shadingId = pdf.add(
    `<< /ShadingType 2 /ColorSpace /DeviceRGB ` +
      `/Coords [${f(CARD.x)} ${f(y(CARD.top))} ${f(CARD.x + CARD.w)} ${f(y(HERO_BOTTOM))}] ` +
      `/Extend [true true] /Function << /FunctionType 2 /Domain [0 1] ` +
      `/C0 [${PURPLE_LIGHT.join(' ')}] /C1 [${PURPLE.join(' ')}] /N 1 >> >>`,
  );

  const c = new Content();

  // 1) Pozadi stranky a bila karta.
  c.fillRect(0, 0, PAGE_W, PAGE_H, PAGE_BG);
  c.fillRound(CARD.x, CARD.top, CARD.w, CARD.h, CARD.r, CARD.r, WHITE);

  // 2) Fialova hlavicka - zaoblena jen nahore, dole navazuje na bilou kartu.
  c.clipRound(CARD.x, CARD.top, CARD.w, HERO_H, CARD.r, 0);
  c.shade('Sh0');
  c.pop();

  // 3) Logo MEDIASPACE, zeleny prouzek a nazev dokumentu.
  c.image('ImLogo', LEFT, LOGO_TOP, (LOGO_H * LOGO.width) / LOGO.height, LOGO_H);
  c.fillRound(LEFT, GREEN_BAR.top, GREEN_BAR.w, GREEN_BAR.h, 1.5, 1.5, GREEN);
  c.text(FONT_BOLD, 'FB', TITLE, TITLE_SIZE, LEFT, TITLE_BASELINE, WHITE);

  // 4) Tabulka udaju. Hudba ma vlastni blok nize.
  const radky = [
    { label: 'NÁZEV SPOTU', value: data.spotName },
    { label: 'KLIENT', value: data.clientName },
    { label: 'DÉLKA SPOTU', value: data.spotLength },
    { label: 'REŽIE', value: data.director },
    { label: 'DATUM VÝROBY', value: data.productionDate },
  ];
  const vyskaTabulky = radky.length * ROW_H;

  c.clipRound(LEFT, TABLE_TOP, INNER_W, vyskaTabulky, TABLE_R, TABLE_R);
  c.fillRect(LEFT, TABLE_TOP, LABEL_W, vyskaTabulky, LABEL_BG);
  for (let i = 1; i < radky.length; i += 1) {
    c.line(LEFT, TABLE_TOP + i * ROW_H, RIGHT, TABLE_TOP + i * ROW_H, BORDER, 1);
  }
  c.pop();
  c.line(SPLIT, TABLE_TOP, SPLIT, TABLE_TOP + vyskaTabulky, BORDER, 1);
  c.strokeRound(LEFT, TABLE_TOP, INNER_W, vyskaTabulky, TABLE_R, TABLE_R, BORDER, 1);

  radky.forEach((radek, index) => {
    const stred = TABLE_TOP + index * ROW_H + ROW_H / 2;
    c.text(
      FONT_BOLD,
      'FB',
      radek.label,
      LABEL_SIZE,
      LEFT + CELL_PAD,
      stred + capHeight(FONT_BOLD, LABEL_SIZE) / 2,
      MUTED,
      LABEL_SPACING,
    );

    const hodnota = fitValue(FONT_BOLD, radek.value, VALUE_MAX_W, VALUE_SIZE);
    const vyskaRadku = hodnota.size * 1.28;
    const zacatek = stred - ((hodnota.lines.length - 1) * vyskaRadku) / 2;
    hodnota.lines.forEach((line, i) => {
      c.text(
        FONT_BOLD,
        'FB',
        line,
        hodnota.size,
        SPLIT + CELL_PAD,
        zacatek + i * vyskaRadku + capHeight(FONT_BOLD, hodnota.size) / 2,
        INK,
      );
    });
  });

  // 5) Hudba ve spotu. Ma vlastni mentolovou plochu, protoze jako jedina cast
  //    dokumentu mluvi o pravech k cizimu dilu - at je videt na prvni pohled.
  c.fillRound(LEFT, MUSIC.top, INNER_W, MUSIC.h, MUSIC.r, MUSIC.r, MINT_BG);
  c.text(FONT_BOLD, 'FB', 'HUDBA VE SPOTU', 8.5, LEFT + CELL_PAD, MUSIC_HEAD_BASELINE, GREEN_DARK, 1.4);

  const sloupceHudby = [
    { x: LEFT + CELL_PAD, label: 'NÁZEV', value: data.musicTitle, max: MUSIC_COL2 - LEFT - CELL_PAD - 14 },
    { x: MUSIC_COL2, label: 'AUTOR', value: data.musicAuthor, max: RIGHT - CELL_PAD - MUSIC_COL2 },
  ];
  for (const sloupec of sloupceHudby) {
    c.text(FONT_BOLD, 'FB', sloupec.label, 7.5, sloupec.x, MUSIC_LABEL_BASELINE, MUTED, 0.7);
    const hodnota = fitValue(FONT_BOLD, sloupec.value, sloupec.max, 12.5);
    hodnota.lines.forEach((line, i) => {
      c.text(FONT_BOLD, 'FB', line, hodnota.size, sloupec.x, MUSIC_VALUE_BASELINE + i * hodnota.size * 1.25, INK);
    });
  }

  // 6) Podpisova cast.
  c.text(FONT_BOLD, 'FB', PRODUCED_BY, PRODUCED_SIZE, LEFT, PRODUCED_BASELINE, INK);
  c.fillRound(SIGN_BOX.x, SIGN_BOX.top, SIGN_BOX.w, SIGN_BOX.h, SIGN_BOX.r, SIGN_BOX.r, LABEL_BG);
  c.strokeRound(SIGN_BOX.x, SIGN_BOX.top, SIGN_BOX.w, SIGN_BOX.h, SIGN_BOX.r, SIGN_BOX.r, BORDER, 1);
  c.text(FONT_BOLD, 'FB', SIGN_LABEL, SIGN_LABEL_SIZE, SIGN_BOX.x + CELL_PAD, SIGN_BOX.top + 20, MUTED, 1.4);
  const vyskaPodpisu = (SIGN_IMAGE_W * SIGNATURE.height) / SIGNATURE.width;
  c.image(
    'ImSign',
    SIGN_BOX.x + (SIGN_BOX.w - SIGN_IMAGE_W) / 2,
    SIGN_BOX.top + SIGN_BOX.h - vyskaPodpisu - 14,
    SIGN_IMAGE_W,
    vyskaPodpisu,
  );

  // 7) Paticka.
  c.line(LEFT, FOOTER_RULE_TOP, RIGHT, FOOTER_RULE_TOP, BORDER, 1);
  const sirkaPaticky = FOOTER_PARTS.reduce(
    (sum, part) => sum + textWidth(part.bold ? FONT_BOLD : FONT_REGULAR, part.text, FOOTER_SIZE),
    0,
  );
  let kurzor = CARD.x + CARD.w / 2 - sirkaPaticky / 2;
  for (const part of FOOTER_PARTS) {
    const font = part.bold ? FONT_BOLD : FONT_REGULAR;
    c.text(font, part.bold ? 'FB' : 'FR', part.text, FOOTER_SIZE, kurzor, FOOTER_BASELINE, part.color);
    kurzor += textWidth(font, part.text, FOOTER_SIZE);
  }

  // 8) Slozeni dokumentu.
  const contentId = pdf.addStream('/Filter /FlateDecode', deflateSync(c.toBuffer(), { level: 9 }));
  const pagesId = pdf.reserve();
  const pageId = pdf.add(
    `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${f(PAGE_W)} ${f(PAGE_H)}] ` +
      `/Resources << /Font << /FR ${regularId} 0 R /FB ${boldId} 0 R >> ` +
      `/XObject << /ImLogo ${logoId} 0 R /ImSign ${signatureId} 0 R >> ` +
      `/Shading << /Sh0 ${shadingId} 0 R >> >> ` +
      `/Contents ${contentId} 0 R >>`,
  );
  pdf.fill(pagesId, `<< /Type /Pages /Kids [${pageId} 0 R] /Count 1 >>`);
  const infoId = pdf.add(
    `<< /Title ${pdfText(`Rodný list – ${data.spotName}`.replace(/[\r\n]+/g, ' '))} ` +
      `/Producer ${pdfText('MEDIA SPACE s.r.o.')} >>`,
  );
  const rootId = pdf.add(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);

  return pdf.build(rootId, infoId);
}
