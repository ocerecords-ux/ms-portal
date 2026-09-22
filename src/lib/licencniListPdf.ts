import { deflateSync } from 'zlib';
import { FONT_BOLD, FONT_REGULAR, LOGO, SIGNATURE } from '@/lib/rodnyListAssets';
import {
  A4,
  BILA,
  capHeight,
  embedFont,
  embedImage,
  f,
  fitValue,
  hex,
  Kresba,
  PdfWriter,
  pdfText,
  textWidth,
  type RGB,
} from '@/lib/pdf/kreslitko';
import type { EmbeddedFont } from '@/lib/rodnyListAssets';

/**
 * LICENČNÍ LIST (zadání 22. 9. 2026: „u reklam budeme klientovi vystavovat
 * licenční listy, netýká se to rádiových spotů. Jde o vymezení licence pro
 * daného herce").
 *
 * Obsah podle vzoru LICENČNÍ_LIST_VZOR.pages, grafika stejná jako Rodný list
 * (fialová hlavička, bílá karta, tabulky se světle fialovým sloupcem popisků)
 * - ať dokumenty Mediaspace vypadají jako jedna rodina. Kreslí se stejným
 * vlastním zapisovačem PDF (viz lib/pdf/kreslitko.ts), stejnými písmy a
 * stejným podpisem jako Rodný list.
 *
 * Rozložení se počítá SHORA DOLŮ kurzorem - odstavce mají proměnlivý počet
 * řádků, takže pevné souřadnice jako u RL by nestačily.
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
const TITLE = 'LICENČNÍ LIST';
const TITLE_SIZE = 25;

const ROW_H = 26;
const LABEL_W = 132;
const SPLIT = LEFT + LABEL_W;
const CELL_PAD = 12;
const LABEL_SIZE = 7.5;
const VALUE_SIZE = 10;
const VALUE_MAX_W = RIGHT - CELL_PAD - (SPLIT + CELL_PAD);

const PARA_SIZE = 9.3;
const PARA_LEAD = 12.6;

export type LicencniListData = {
  nazevSpotu: string;
  klient: string;
  objednatel: string;
  dodavatel: string;
  interpret: string;
  typDila: string;
  uzemi: string;
  media: string;
  delkaLicence: string;
  /** „výhradní" / „nevýhradní". */
  typLicence: string;
  /** Už naformátované, např. „20. 3. 2026". */
  datumVyroby: string;
  /** Odstavce o prodloužení a podmínkách - oddělené prázdným řádkem. */
  podminky: string;
  misto: string;
  /** Datum vystavení, naformátované. */
  datum: string;
  podepisuje: string;
};

export const VYCHOZI_PODMINKY =
  'Dodavatel je oprávněn udělit tuto licenci na základě smluvního vztahu s interpretem. ' +
  'Použití mimo výše uvedený rozsah podléhá novému licenčnímu ujednání.\n\n' +
  'Objednatel je oprávněn požádat o prodloužení licence na další období 12 měsíců za poplatek ' +
  've výši 100 % původního licenčního honoráře. Tato opce je platná pro období následujících ' +
  'dvou let po skončení původní licence. Prodloužení musí být písemně potvrzeno oběma stranami.';

/** Zalomí odstavec na řádky dané šířky (bez zmenšování písma). */
function zalom(font: EmbeddedFont, text: string, sirka: number, velikost: number): string[] {
  const radky: string[] = [];
  let radek = '';
  for (const slovo of text.split(/\s+/).filter(Boolean)) {
    const zkusit = radek ? `${radek} ${slovo}` : slovo;
    if (!radek || textWidth(font, zkusit, velikost) <= sirka) radek = zkusit;
    else {
      radky.push(radek);
      radek = slovo;
    }
  }
  if (radek) radky.push(radek);
  return radky;
}

const FOOTER_PARTS: { text: string; color: RGB; bold?: boolean }[] = [
  { text: 'MEDIA SPACE s.r.o.', color: INK, bold: true },
  { text: '   •   ', color: MUTED },
  { text: 'www.mediaspace.cz', color: PURPLE },
  { text: '   •   ', color: MUTED },
  { text: 'info@mediaspace.cz', color: PURPLE },
];

export function renderLicencniListPdf(data: LicencniListData): Buffer {
  const pdf = new PdfWriter();
  const regularId = embedFont(pdf, FONT_REGULAR, 'LiberationSans');
  const boldId = embedFont(pdf, FONT_BOLD, 'LiberationSans-Bold');
  const logoId = embedImage(pdf, LOGO);
  const signatureId = embedImage(pdf, SIGNATURE);
  const heroBottom = CARD.top + HERO_H;
  const shadingId = pdf.add(
    `<< /ShadingType 2 /ColorSpace /DeviceRGB ` +
      `/Coords [${f(CARD.x)} ${f(PAGE_H - CARD.top)} ${f(CARD.x + CARD.w)} ${f(PAGE_H - heroBottom)}] ` +
      `/Extend [true true] /Function << /FunctionType 2 /Domain [0 1] ` +
      `/C0 [${PURPLE_LIGHT.join(' ')}] /C1 [${PURPLE.join(' ')}] /N 1 >> >>`,
  );

  const c = new Kresba(PAGE_H);

  // Pozadí, karta, hlavička.
  c.fillRect(0, 0, PAGE_W, PAGE_H, PAGE_BG);
  c.fillRound(CARD.x, CARD.top, CARD.w, CARD.h, CARD.r, CARD.r, WHITE);
  c.clipRound(CARD.x, CARD.top, CARD.w, HERO_H, CARD.r, 0);
  c.shade('Sh0');
  c.pop();
  c.image('ImLogo', LEFT, LOGO_TOP, (LOGO_H * LOGO.width) / LOGO.height, LOGO_H);
  c.fillRound(LEFT, LOGO_TOP + LOGO_H + 12, 42, 3, 1.5, 1.5, GREEN);
  c.text(FONT_BOLD, 'FB', TITLE, TITLE_SIZE, LEFT, heroBottom - 18, WHITE);

  let y = heroBottom + 20;

  /** Tabulka popisek → hodnota; vrací spodní hranu. */
  const tabulka = (top: number, radky: { label: string; value: string }[]): number => {
    const hodnoty = radky.map((r) => fitValue(FONT_BOLD, r.value || '—', VALUE_MAX_W, VALUE_SIZE));
    const vysky = hodnoty.map((h) => (h.lines.length > 1 ? ROW_H + (h.lines.length - 1) * h.size * 1.25 : ROW_H));
    const celkem = vysky.reduce((a, b) => a + b, 0);
    c.clipRound(LEFT, top, INNER_W, celkem, 10, 10);
    c.fillRect(LEFT, top, LABEL_W, celkem, LABEL_BG);
    let t = top;
    vysky.forEach((v, i) => {
      if (i > 0) c.line(LEFT, t, RIGHT, t, BORDER, 1);
      t += v;
    });
    c.pop();
    c.line(SPLIT, top, SPLIT, top + celkem, BORDER, 1);
    c.strokeRound(LEFT, top, INNER_W, celkem, 10, 10, BORDER, 1);

    t = top;
    radky.forEach((r, i) => {
      const stred = t + vysky[i] / 2;
      c.text(FONT_BOLD, 'FB', r.label, LABEL_SIZE, LEFT + CELL_PAD, stred + capHeight(FONT_BOLD, LABEL_SIZE) / 2, MUTED, 0.6);
      const h = hodnoty[i];
      const lead = h.size * 1.25;
      const zacatek = stred - ((h.lines.length - 1) * lead) / 2;
      h.lines.forEach((line, j) => {
        c.text(FONT_BOLD, 'FB', line, h.size, SPLIT + CELL_PAD, zacatek + j * lead + capHeight(FONT_BOLD, h.size) / 2, INK);
      });
      t += vysky[i];
    });
    return top + celkem;
  };

  const nadpis = (text: string) => {
    y += 22;
    c.text(FONT_BOLD, 'FB', text, 8.5, LEFT, y, PURPLE, 1.2);
    y += 8;
  };

  const odstavec = (text: string) => {
    for (const radek of zalom(FONT_REGULAR, text, INNER_W, PARA_SIZE)) {
      y += PARA_LEAD;
      c.text(FONT_REGULAR, 'FR', radek, PARA_SIZE, LEFT, y, INK);
    }
    y += 5;
  };

  // 1) Strany a dílo.
  y = tabulka(y, [
    { label: 'NÁZEV SPOTU', value: data.nazevSpotu },
    { label: 'KLIENT', value: data.klient },
    { label: 'OBJEDNATEL', value: data.objednatel },
    { label: 'DODAVATEL', value: data.dodavatel },
    { label: 'INTERPRET', value: data.interpret },
    { label: 'TYP DÍLA', value: data.typDila },
  ]);

  // 2) Udělení licence.
  nadpis('UDĚLENÍ LICENCE');
  const typ = (data.typLicence || 'nevýhradní').trim().toLowerCase();
  odstavec(
    `Dodavatel tímto uděluje ${typ} licenci k užití hlasového výkonu speakera na omezenou dobu ` +
      'pro výše uvedený spot v následujícím rozsahu:',
  );
  y = tabulka(y + 6, [
    { label: 'ÚZEMÍ', value: data.uzemi },
    { label: 'MÉDIA', value: data.media },
    { label: 'DÉLKA LICENCE', value: data.delkaLicence },
    { label: 'TYP LICENCE', value: typ },
    { label: 'DATUM VÝROBY', value: data.datumVyroby },
  ]);

  // 3) Prodloužení a podmínky.
  nadpis('PRODLOUŽENÍ LICENCE');
  for (const cast of (data.podminky || '').split(/\n\s*\n/).map((t) => t.trim()).filter(Boolean)) {
    odstavec(cast.replace(/\s*\n\s*/g, ' '));
  }

  // 4) Místo, datum, podpis.
  const FOOTER_RULE_TOP = CARD.top + CARD.h - 44;
  const signBox = { w: 190, h: 74 };
  const signTop = Math.min(Math.max(y + 20, 0), FOOTER_RULE_TOP - signBox.h - 14);
  const signX = RIGHT - signBox.w;
  c.text(FONT_REGULAR, 'FR', `V ${data.misto || 'Brně'}, dne ${data.datum}`, 10, LEFT, signTop + 22, INK);
  const za = 'Za ';
  const firma = 'MEDIA SPACE s.r.o.';
  let x = LEFT;
  c.text(FONT_REGULAR, 'FR', za, 10, x, signTop + 40, INK);
  x += textWidth(FONT_REGULAR, za, 10);
  c.text(FONT_BOLD, 'FB', firma, 10, x, signTop + 40, INK);
  x += textWidth(FONT_BOLD, `${firma} `, 10);
  c.text(FONT_REGULAR, 'FR', data.podepisuje, 10, x, signTop + 40, INK);

  c.fillRound(signX, signTop, signBox.w, signBox.h, 10, 10, LABEL_BG);
  c.strokeRound(signX, signTop, signBox.w, signBox.h, 10, 10, BORDER, 1);
  c.text(FONT_BOLD, 'FB', 'PODPIS', 7.5, signX + CELL_PAD, signTop + 17, MUTED, 1.2);
  const sirkaPodpisu = 100;
  const vyskaPodpisu = (sirkaPodpisu * SIGNATURE.height) / SIGNATURE.width;
  c.image('ImSign', signX + (signBox.w - sirkaPodpisu) / 2, signTop + signBox.h - vyskaPodpisu - 10, sirkaPodpisu, vyskaPodpisu);

  // 5) Patička.
  c.line(LEFT, FOOTER_RULE_TOP, RIGHT, FOOTER_RULE_TOP, BORDER, 1);
  const FOOTER_SIZE = 9;
  const sirka = FOOTER_PARTS.reduce((s, p) => s + textWidth(p.bold ? FONT_BOLD : FONT_REGULAR, p.text, FOOTER_SIZE), 0);
  let kurzor = CARD.x + CARD.w / 2 - sirka / 2;
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
      `/XObject << /ImLogo ${logoId} 0 R /ImSign ${signatureId} 0 R >> ` +
      `/Shading << /Sh0 ${shadingId} 0 R >> >> ` +
      `/Contents ${contentId} 0 R >>`,
  );
  pdf.fill(pagesId, `<< /Type /Pages /Kids [${pageId} 0 R] /Count 1 >>`);
  const infoId = pdf.add(
    `<< /Title ${pdfText(`Licenční list – ${data.nazevSpotu} – ${data.interpret}`.replace(/[\r\n]+/g, ' '))} ` +
      `/Producer ${pdfText('MEDIA SPACE s.r.o.')} >>`,
  );
  const rootId = pdf.add(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
  return pdf.build(rootId, infoId);
}

/** „LL_Kendamil_HU_Zita_Teby.pdf" */
export function licencniListFileName(nazevSpotu: string, interpret: string): string {
  const cisti = (t: string) =>
    t
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^A-Za-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 60);
  return `LL_${[cisti(nazevSpotu), cisti(interpret)].filter(Boolean).join('_') || 'spot'}.pdf`;
}
