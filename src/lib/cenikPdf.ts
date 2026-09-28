import { deflateSync } from 'zlib';
import { FONT_BOLD, FONT_REGULAR, LOGO } from '@/lib/rodnyListAssets';
import type { EmbeddedFont } from '@/lib/rodnyListAssets';
import {
  A4,
  BILA,
  capHeight,
  embedFont,
  embedImage,
  f,
  hex,
  Kresba,
  PdfWriter,
  pdfText,
  textWidth,
  type RGB,
} from '@/lib/pdf/kreslitko';
import { cena, platnost, type Cenik } from '@/lib/studioCenik';

/**
 * CENÍK STUDIA V PDF (zadání 28. 9. 2026: „aby se pak dalo poslat někomu PDF
 * nebo stáhnout. Vytvoř v našem brandu.").
 *
 * Grafika je stejná rodina jako Rodný a Licenční list - fialová hlavička
 * s logem, bílá karta, zelený proužek, světle fialové plochy, patička
 * Mediaspace. Kreslí se stejným vlastním zapisovačem (lib/pdf/kreslitko.ts),
 * takže ceník nepřidává portálu ani jednu novou závislost.
 *
 * ROZLOŽENÍ SE POČÍTÁ SHORA DOLŮ kurzorem `y`. Popisy sloupců i poznámka pod
 * tabulkou jsou volný text, kterému nikdo nehlídá délku - pevné souřadnice by
 * po prvním delším odstavci přestaly platit.
 *
 * DRUHÝ CENOVÝ SLOUPEC JE DOBROVOLNÝ. Když ho ceník nemá, tabulka je
 * dvousloupcová (popis + cena) a karty s popisy se roztáhnou přes celou šířku.
 */

const PAGE_W = A4.w;
const PAGE_H = A4.h;

const PURPLE = hex('#6B2AF0');
const PURPLE_LIGHT = hex('#7B55FF');
const GREEN = hex('#1FDF67');
const INK = hex('#201A33');
const MUTED = hex('#6E6580');
const BORDER = hex('#E4DFFB');
const LABEL_BG = hex('#F7F5FF');
const PAGE_BG = hex('#FBFAFF');
const WHITE = BILA;

const CARD = { x: 36, top: 30, w: PAGE_W - 72, h: PAGE_H - 60, r: 16 };
const PAD = 30;
const LEFT = CARD.x + PAD;
const RIGHT = CARD.x + CARD.w - PAD;
const INNER_W = RIGHT - LEFT;

const HERO_H = 104;
const LOGO_H = 26;
const LOGO_TOP = CARD.top + 22;
const TITLE_SIZE = 22;

const ROW_H = 30;
const HEAD_H = 28;
const CELL_PAD = 14;

const PARA_SIZE = 9.3;
const PARA_LEAD = 12.6;

const FOOTER_RULE_TOP = CARD.top + CARD.h - 52;

const FOOTER_PARTS: { text: string; color: RGB; bold?: boolean }[] = [
  { text: 'MEDIA SPACE s.r.o.', color: INK, bold: true },
  { text: '   •   ', color: MUTED },
  { text: 'www.mediaspace.cz', color: PURPLE },
  { text: '   •   ', color: MUTED },
  { text: 'info@mediaspace.cz', color: PURPLE },
];

/** Zalomí odstavec na řádky dané šířky (bez zmenšování písma). */
function zalom(font: EmbeddedFont, text: string, sirka: number, velikost: number): string[] {
  const radky: string[] = [];
  for (const kus of text.split('\n')) {
    if (!kus.trim()) {
      radky.push('');
      continue;
    }
    let radek = '';
    for (const slovo of kus.split(/\s+/).filter(Boolean)) {
      const zkusit = radek ? `${radek} ${slovo}` : slovo;
      if (!radek || textWidth(font, zkusit, velikost) <= sirka) radek = zkusit;
      else {
        radky.push(radek);
        radek = slovo;
      }
    }
    if (radek) radky.push(radek);
  }
  return radky;
}

export type CenikPdfData = Cenik & {
  /** První sloupec tabulky - „Session length". */
  zahlaviPopisu?: string;
};

export function renderCenikPdf(data: CenikPdfData): Buffer {
  const dvaSloupce = Boolean(data.sloupec2?.trim());
  const pdf = new PdfWriter();
  const regularId = embedFont(pdf, FONT_REGULAR, 'LiberationSans');
  const boldId = embedFont(pdf, FONT_BOLD, 'LiberationSans-Bold');
  const logoId = embedImage(pdf, LOGO);
  const heroBottom = CARD.top + HERO_H;
  const shadingId = pdf.add(
    `<< /ShadingType 2 /ColorSpace /DeviceRGB ` +
      `/Coords [${f(CARD.x)} ${f(PAGE_H - CARD.top)} ${f(CARD.x + CARD.w)} ${f(PAGE_H - heroBottom)}] ` +
      `/Extend [true true] /Function << /FunctionType 2 /Domain [0 1] ` +
      `/C0 [${PURPLE_LIGHT.join(' ')}] /C1 [${PURPLE.join(' ')}] /N 1 >> >>`,
  );

  const c = new Kresba(PAGE_H);

  // --- Podklad, karta, fialová hlavička s logem a názvem studia ------------
  c.fillRect(0, 0, PAGE_W, PAGE_H, PAGE_BG);
  c.fillRound(CARD.x, CARD.top, CARD.w, CARD.h, CARD.r, CARD.r, WHITE);
  c.clipRound(CARD.x, CARD.top, CARD.w, HERO_H, CARD.r, 0);
  c.shade('Sh0');
  c.pop();
  c.image('ImLogo', LEFT, LOGO_TOP, (LOGO_H * LOGO.width) / LOGO.height, LOGO_H);
  c.fillRound(LEFT, LOGO_TOP + LOGO_H + 12, 42, 3, 1.5, 1.5, GREEN);
  // Dlouhý název se zmenší, ať se vejde na jeden řádek a nevyleze z hlavičky.
  let velikostNadpisu = TITLE_SIZE;
  while (velikostNadpisu > 11 && textWidth(FONT_BOLD, data.nadpis, velikostNadpisu) > INNER_W) {
    velikostNadpisu -= 0.5;
  }
  c.text(FONT_BOLD, 'FB', data.nadpis, velikostNadpisu, LEFT, heroBottom - 18, WHITE);

  let y = heroBottom + 34;

  // --- Podnadpis a platnost ------------------------------------------------
  if (data.podnadpis?.trim()) {
    c.text(FONT_BOLD, 'FB', data.podnadpis.trim(), 14, LEFT, y, INK);
    y += 16;
  }
  const doKdy = platnost(data.platnostDo || null);
  if (doKdy) {
    c.text(FONT_REGULAR, 'FR', `Valid until ${doKdy}`, PARA_SIZE, LEFT, y, MUTED);
    y += 10;
  }
  y += 14;

  // --- Karty s popisem sloupců --------------------------------------------
  const popisy = [
    { nazev: data.sloupec1, popis: data.sloupec1Popis },
    ...(dvaSloupce ? [{ nazev: data.sloupec2 as string, popis: data.sloupec2Popis }] : []),
  ].filter((k) => k.nazev?.trim() || k.popis?.trim());

  if (popisy.length > 0) {
    const mezera = 14;
    const sirka = popisy.length > 1 ? (INNER_W - mezera) / popisy.length : INNER_W;
    const radkyKaret = popisy.map((k) =>
      k.popis?.trim() ? zalom(FONT_REGULAR, k.popis.trim(), sirka - 2 * CELL_PAD, 8.6) : [],
    );
    const vyska = 22 + Math.max(...radkyKaret.map((r) => r.length)) * 11.5 + 16;

    popisy.forEach((k, i) => {
      const x = LEFT + i * (sirka + mezera);
      c.fillRound(x, y, sirka, vyska, 10, 10, LABEL_BG);
      c.strokeRound(x, y, sirka, vyska, 10, 10, BORDER, 1);
      c.text(FONT_BOLD, 'FB', k.nazev.trim().toUpperCase(), 8, x + CELL_PAD, y + 18, PURPLE, 1);
      radkyKaret[i].forEach((radek, j) => {
        c.text(FONT_REGULAR, 'FR', radek, 8.6, x + CELL_PAD, y + 34 + j * 11.5, INK);
      });
    });
    y += vyska + 24;
  }

  // --- Tabulka cen ---------------------------------------------------------
  const sirkaCeny = dvaSloupce ? 130 : 160;
  const sirkaPopisu = INNER_W - sirkaCeny * (dvaSloupce ? 2 : 1);
  const xCena1 = LEFT + sirkaPopisu;
  const xCena2 = xCena1 + sirkaCeny;

  const tabulkaTop = y;
  const vyskaTabulky = HEAD_H + data.radky.length * ROW_H;

  c.clipRound(LEFT, tabulkaTop, INNER_W, vyskaTabulky, 10, 10);
  // Záhlaví má fialový podklad, ať je na první pohled vidět, kde tabulka začíná.
  c.fillRect(LEFT, tabulkaTop, INNER_W, HEAD_H, LABEL_BG);
  data.radky.forEach((_, i) => {
    // Každý druhý řádek světle podbarvený - v tabulce o čtyřech sloupcích se
    // pak oko nesveze o řádek vedle.
    if (i % 2 === 1) c.fillRect(LEFT, tabulkaTop + HEAD_H + i * ROW_H, INNER_W, ROW_H, PAGE_BG);
  });
  c.pop();

  // Svislé předěly mezi sloupci.
  c.line(xCena1, tabulkaTop, xCena1, tabulkaTop + vyskaTabulky, BORDER, 1);
  if (dvaSloupce) c.line(xCena2, tabulkaTop, xCena2, tabulkaTop + vyskaTabulky, BORDER, 1);
  // Vodorovné čáry pod záhlavím a mezi řádky.
  c.line(LEFT, tabulkaTop + HEAD_H, RIGHT, tabulkaTop + HEAD_H, BORDER, 1);
  data.radky.forEach((_, i) => {
    if (i > 0) {
      const t = tabulkaTop + HEAD_H + i * ROW_H;
      c.line(LEFT, t, RIGHT, t, BORDER, 1);
    }
  });
  c.strokeRound(LEFT, tabulkaTop, INNER_W, vyskaTabulky, 10, 10, BORDER, 1);

  // Záhlaví.
  const zahlaviY = tabulkaTop + HEAD_H / 2 + capHeight(FONT_BOLD, 8) / 2;
  c.text(FONT_BOLD, 'FB', (data.zahlaviPopisu || 'Session length').toUpperCase(), 8, LEFT + CELL_PAD, zahlaviY, MUTED, 0.8);
  naPravo(c, data.sloupec1.toUpperCase(), 8, xCena1 + sirkaCeny - CELL_PAD, zahlaviY, MUTED, FONT_BOLD, 'FB', 0.8);
  if (dvaSloupce) {
    naPravo(c, (data.sloupec2 as string).toUpperCase(), 8, xCena2 + sirkaCeny - CELL_PAD, zahlaviY, MUTED, FONT_BOLD, 'FB', 0.8);
  }

  // Řádky.
  data.radky.forEach((r, i) => {
    const stred = tabulkaTop + HEAD_H + i * ROW_H + ROW_H / 2;
    const zaklad = stred + capHeight(FONT_BOLD, 10) / 2;
    c.text(FONT_REGULAR, 'FR', r.popis, 10, LEFT + CELL_PAD, zaklad, INK);
    const c1 = cena(r.cena1Minor, data.mena, r.od1);
    naPravo(c, c1, 10.5, xCena1 + sirkaCeny - CELL_PAD, zaklad, c1 === '—' ? MUTED : INK, FONT_BOLD, 'FB');
    if (dvaSloupce) {
      const c2 = cena(r.cena2Minor, data.mena, r.od2);
      naPravo(c, c2, 10.5, xCena2 + sirkaCeny - CELL_PAD, zaklad, c2 === '—' ? MUTED : INK, FONT_BOLD, 'FB');
    }
  });

  y = tabulkaTop + vyskaTabulky + 20;

  // --- Poznámka pod tabulkou ----------------------------------------------
  if (data.poznamka?.trim()) {
    for (const radek of zalom(FONT_REGULAR, data.poznamka.trim(), INNER_W, PARA_SIZE)) {
      y += PARA_LEAD;
      if (y > FOOTER_RULE_TOP - 12) break; // Na jednu stránku se víc nevejde.
      c.text(FONT_REGULAR, 'FR', radek, PARA_SIZE, LEFT, y, MUTED);
    }
  }

  // --- Patička -------------------------------------------------------------
  c.line(LEFT, FOOTER_RULE_TOP, RIGHT, FOOTER_RULE_TOP, BORDER, 1);
  const FOOTER_SIZE = 9;
  const sirkaPaticky = FOOTER_PARTS.reduce(
    (s, p) => s + textWidth(p.bold ? FONT_BOLD : FONT_REGULAR, p.text, FOOTER_SIZE),
    0,
  );
  let kurzor = CARD.x + CARD.w / 2 - sirkaPaticky / 2;
  for (const p of FOOTER_PARTS) {
    const font = p.bold ? FONT_BOLD : FONT_REGULAR;
    c.text(font, p.bold ? 'FB' : 'FR', p.text, FOOTER_SIZE, kurzor, FOOTER_RULE_TOP + 22, p.color);
    kurzor += textWidth(font, p.text, FOOTER_SIZE);
  }

  const contentId = pdf.addStream('/Filter /FlateDecode', deflateSync(c.toBuffer(), { level: 9 }));
  const pagesId = pdf.reserve();
  const pageId = pdf.add(
    `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${f(PAGE_W)} ${f(PAGE_H)}] ` +
      `/Resources << /Font << /FR ${regularId} 0 R /FB ${boldId} 0 R >> ` +
      `/XObject << /ImLogo ${logoId} 0 R >> ` +
      `/Shading << /Sh0 ${shadingId} 0 R >> >> ` +
      `/Contents ${contentId} 0 R >>`,
  );
  pdf.fill(pagesId, `<< /Type /Pages /Kids [${pageId} 0 R] /Count 1 >>`);
  const infoId = pdf.add(
    `<< /Title ${pdfText(`${data.nadpis} – ${data.podnadpis || 'Price List'}`.replace(/[\r\n]+/g, ' '))} ` +
      `/Producer ${pdfText('MEDIA SPACE s.r.o.')} >>`,
  );
  const rootId = pdf.add(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
  return pdf.build(rootId, infoId);
}

/** Text zarovnaný na pravou hranu sloupce - ceny se čtou zprava. */
function naPravo(
  c: Kresba,
  text: string,
  size: number,
  pravaHrana: number,
  baseline: number,
  color: RGB,
  font: EmbeddedFont,
  name: string,
  spacing = 0,
) {
  const sirka = textWidth(font, text, size) + spacing * Math.max(0, text.length - 1);
  c.text(font, name, text, size, pravaHrana - sirka, baseline, color, spacing);
}
