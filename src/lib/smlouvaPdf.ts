import { deflateSync } from 'zlib';
import { jeCisloSmlouvy, nezlomitelneCastky, popisekDruheStrany, popisekNaseStrany } from '@/lib/contracts';
import { FONT_BOLD, FONT_REGULAR, LOGO, type EmbeddedImage } from '@/lib/rodnyListAssets';
import {
  A4,
  BILA,
  embedFont,
  embedImage,
  f,
  hex,
  Kresba,
  PdfWriter,
  pdfText,
  textWidth,
} from '@/lib/pdf/kreslitko';
import { dekodujPng } from '@/lib/pdf/png';

/**
 * PODEPSANÁ SMLOUVA JAKO PDF (zadání 14. 9. 2026: „u podepsaných smluv oboji.
 * Odkaz i pdf").
 *
 * Do té doby podepsaná smlouva existovala jen jako stránka portálu. Odkaz je
 * fajn na čtení, ale do složky zakázky ani do účetnictví se odkaz nezaloží -
 * proto je v mailu i příloha.
 *
 * SAZBA JE ZÁMĚRNĚ TA SAMÁ JAKO NA STRÁNCE (ContractPaper.tsx): fialová
 * hlavička se zeleným proužkem, nadpisy podle tvaru řádku, dole obě doložky.
 * Kdyby PDF vypadalo jinak než to, co člověk podepisoval, byl by to jiný
 * dokument - a přesně tomu se u smlouvy chceme vyhnout.
 *
 * Stránkování tady NENÍ to z lib/smlouvaStranky.ts: to počítá stránky pro
 * odklikávání v prohlížeči (deterministicky z textu, bez písma), kdežto tady
 * se láme podle skutečné výšky sazby. Obojí popisuje tentýž text, jen k jinému
 * účelu.
 */

const PAGE_W = A4.w;
const PAGE_H = A4.h;

const PURPLE = hex('#6B2AF0');
const GREEN = hex('#1FDF67');
const INK = hex('#201A33');
const MUTED = hex('#6E6580');
const BORDER = hex('#E4DFFB');
const TINT = hex('#F7F5FF');
const DANGER = hex('#C22B2B');

const LEFT = 56;
const RIGHT = PAGE_W - 56;
const SIRKA = RIGHT - LEFT;

/** Hlavička je jen na první straně; další začínají výš. */
const HLAVICKA_H = 104;
const PRVNI_TOP = HLAVICKA_H + 46;
const DALSI_TOP = 64;
const SPODEK = PAGE_H - 62;

const TEXT_SIZE = 9.8;
const RADEK = 14;
const NADPIS_SIZE = 10.5;

export type PodpisDoPdf = {
  role: 'MEDIASPACE' | 'PROTISTRANA';
  name: string;
  email: string | null;
  signedAt: Date;
  ip: string | null;
  documentHash: string;
  /** PNG v data URL, jak ho nakreslil podepisující. */
  imageData: string;
};

export type SmlouvaPdfData = {
  number: string;
  title: string;
  body: string;
  podpisy: PodpisDoPdf[];
  /** Otisk textu, jak vypadá teď - porovnává se s otiskem u podpisů. */
  currentHash: string;
  /** Naše firma - píše se k podpisu („ZA MEDIA SPACE S.R.O."). */
  issuerName?: string | null;
};

/** Nadpis / popisek strany / běžný odstavec - stejné pravidlo jako ContractPaper. */
function druhRadku(text: string): 'nadpis' | 'popisek' | 'text' {
  if (text.length > 90) return 'text';
  if (!text.includes(':')) {
    const bezCisla = text.replace(/^[\dIVXL]+([.)]\d*)*[.)]?\s+/i, '');
    const pismena = bezCisla.replace(/[^\p{L}]/gu, '');
    if (pismena.length >= 3 && !/\d/.test(bezCisla) && pismena === pismena.toLocaleUpperCase('cs-CZ')) {
      return 'nadpis';
    }
    if (/^[IVXL]{1,5}\.\s+\p{Lu}/u.test(text)) return 'nadpis';
  }
  if (text.length <= 40 && text.endsWith(':') && !/^\d/.test(text)) return 'popisek';
  return 'text';
}

/** Zalomí text na řádky, které se vejdou do dané šířky. */
function zalom(font: typeof FONT_REGULAR, text: string, size: number, sirka: number): string[] {
  const slova = text.split(/\s+/).filter(Boolean);
  if (slova.length === 0) return [''];
  const radky: string[] = [];
  let radek = '';
  for (const slovo of slova) {
    const zkouska = radek ? `${radek} ${slovo}` : slovo;
    if (textWidth(font, zkouska, size) <= sirka || !radek) {
      radek = zkouska;
    } else {
      radky.push(radek);
      radek = slovo;
    }
  }
  if (radek) radky.push(radek);
  return radky;
}


/**
 * TUČNÉ KOUSKY V TEXTU (zadání 15. 9. 2026: „důležité věci bych zvýraznil
 * tučně"). V šabloně se píší jako **takhle** - stejný zápis, jaký portál
 * používá ve zprávách klientům.
 *
 * Sází se to po slovech: každé slovo se změří vlastním řezem písma, takže
 * tučný kousek uprostřed věty nerozhodí zalomení řádku.
 */
type Slovo = { slovo: string; tucne: boolean };

function naUseky(text: string): { text: string; tucne: boolean }[] {
  const out: { text: string; tucne: boolean }[] = [];
  const re = /\*\*([^*]+)\*\*/g;
  let i = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > i) out.push({ text: text.slice(i, m.index), tucne: false });
    out.push({ text: m[1], tucne: true });
    i = m.index + m[0].length;
  }
  if (i < text.length) out.push({ text: text.slice(i), tucne: false });
  return out.length ? out : [{ text, tucne: false }];
}

/**
 * Znacka misto mezery uvnitr castky. Pevna mezera (U+00A0) v subsetu fontu
 * neni a vysazela by se jako otaznik, takze se castka drzi pohromade tehle
 * znackou a tesne pred kreslenim se z ni udela zase obycejna mezera.
 */
const SPOJKA = '\u0001';

function naSlova(text: string, zakladTucny: boolean): Slovo[] {
  const out: Slovo[] = [];
  for (const usek of naUseky(nezlomitelneCastky(text, SPOJKA))) {
    for (const slovo of usek.text.split(/[ \t\n\r]+/).filter(Boolean)) {
      // „7<SPOJKA>888<SPOJKA>Kč" je jedno slovo - zalomeni ho uz nerozdeli.
      out.push({ slovo: slovo.split(SPOJKA).join(' '), tucne: zakladTucny || usek.tucne });
    }
  }
  return out;
}

/** Zalomení textu s tučnými kousky - vrací řádky složené ze slov. */
function zalomSlova(slova: Slovo[], size: number, sirka: number): Slovo[][] {
  if (slova.length === 0) return [[]];
  const mezera = textWidth(FONT_REGULAR, ' ', size);
  const radky: Slovo[][] = [];
  let radek: Slovo[] = [];
  let sirkaRadku = 0;
  for (const s of slova) {
    const w = textWidth(s.tucne ? FONT_BOLD : FONT_REGULAR, s.slovo, size);
    const pridat = radek.length === 0 ? w : sirkaRadku + mezera + w;
    if (pridat <= sirka || radek.length === 0) {
      radek.push(s);
      sirkaRadku = pridat;
    } else {
      radky.push(radek);
      radek = [s];
      sirkaRadku = w;
    }
  }
  if (radek.length) radky.push(radek);
  return radky;
}

function datumCas(d: Date): string {
  return new Intl.DateTimeFormat('cs-CZ', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

/** Jedna rozepsaná stránka: kresba a kam až se na ní došlo. */
type Stranka = { c: Kresba; top: number };

export function smlouvaPdf(data: SmlouvaPdfData): Buffer {
  const pdf = new PdfWriter();
  const regularId = embedFont(pdf, FONT_REGULAR, 'MSPortalRegular');
  const boldId = embedFont(pdf, FONT_BOLD, 'MSPortalBold');
  const logoId = embedImage(pdf, LOGO);

  // Obrazky podpisu. Co se nepodari precist, se proste nevykresli - udaje
  // z dolozky (jmeno, cas, IP, otisk) zustavaji a ty jsou to podstatne.
  const obrazky: { klic: string; obraz: EmbeddedImage; id: number }[] = [];
  for (const [i, podpis] of data.podpisy.entries()) {
    const obraz = dekodujPng(podpis.imageData);
    if (!obraz) continue;
    obrazky.push({ klic: `ImP${i}`, obraz, id: embedImage(pdf, obraz) });
  }
  const obrazekPodpisu = (podpis: PodpisDoPdf) => {
    const index = data.podpisy.indexOf(podpis);
    return obrazky.find((o) => o.klic === `ImP${index}`) ?? null;
  };

  const stranky: Stranka[] = [];

  function novaStranka(): Stranka {
    const prvni = stranky.length === 0;
    const c = new Kresba(PAGE_H);
    if (prvni) {
      c.fillRect(0, 0, PAGE_W, HLAVICKA_H, PURPLE);
      c.fillRect(0, HLAVICKA_H, PAGE_W, 3, GREEN);
      c.text(FONT_BOLD, 'FB', `SMLOUVA ${data.number}`, 8.5, LEFT, 40, GREEN, 1.4);
      for (const radek of zalom(FONT_BOLD, data.title, 19, SIRKA - 120).slice(0, 2)) {
        c.text(FONT_BOLD, 'FB', radek, 19, LEFT, 70, BILA);
      }
      const logoH = 26;
      c.image('ImLogo', RIGHT - (logoH * LOGO.width) / LOGO.height, 34, (logoH * LOGO.width) / LOGO.height, logoH);
    }
    const s: Stranka = { c, top: prvni ? PRVNI_TOP : DALSI_TOP };
    stranky.push(s);
    return s;
  }

  let s = novaStranka();

  /** Zajistí, že na stránce zbývá aspoň `potreba` bodů; jinak založí další. */
  function mistoNeboNova(potreba: number) {
    if (s.top + potreba > SPODEK) s = novaStranka();
  }

  // --- Text smlouvy --------------------------------------------------------
  /**
   * Prázdné řádky na konci těla se zahazují a delší mezery se krátí: ve
   * smlouvě na ně nikdo nekouká, ale posčítaly se do výšky a podpisy kvůli
   * nim odskočily na další stránku (viděno 15. 9. 2026 na S2026001).
   */
  const radky = data.body
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\s+$/, '')
    .split('\n');
  let prvniNeprazdny = true;

  for (const syrovy of radky) {
    const text = syrovy.trim();
    if (!text) {
      s.top += 7;
      continue;
    }

    if (prvniNeprazdny) {
      // Titul smlouvy - na sirku, vycentrovany, jako na strance.
      prvniNeprazdny = false;
      mistoNeboNova(40);
      for (const radek of zalom(FONT_BOLD, text.replace(/\*\*/g, '').toLocaleUpperCase('cs-CZ'), 14, SIRKA)) {
        const x = LEFT + (SIRKA - textWidth(FONT_BOLD, radek, 14)) / 2;
        s.c.text(FONT_BOLD, 'FB', radek, 14, x, s.top + 11, INK, 0.6);
        s.top += 19;
      }
      s.top += 10;
      continue;
    }

    // Cislo smlouvy patri vpravo a tucne - stejne jako na strance
    // (zadani 15. 9. 2026).
    if (jeCisloSmlouvy(text)) {
      const cisty = text.replace(/\*\*/g, '');
      for (const radek of zalom(FONT_BOLD, cisty, TEXT_SIZE, SIRKA)) {
        mistoNeboNova(RADEK);
        s.c.text(
          FONT_BOLD,
          'FB',
          radek,
          TEXT_SIZE,
          RIGHT - textWidth(FONT_BOLD, radek, TEXT_SIZE),
          s.top + 8,
          INK,
        );
        s.top += RADEK;
      }
      continue;
    }

    const druh = druhRadku(text);

    if (druh === 'nadpis') {
      mistoNeboNova(34);
      s.top += 10;
      for (const radek of zalom(FONT_BOLD, text.replace(/\*\*/g, ''), NADPIS_SIZE, SIRKA)) {
        s.c.text(FONT_BOLD, 'FB', radek, NADPIS_SIZE, LEFT, s.top + 8, PURPLE, 0.8);
        s.top += RADEK;
      }
      s.top += 2;
      continue;
    }

    // Tucne kousky **takhle** se sazi po slovech - viz zalomSlova.
    const mezera = textWidth(FONT_REGULAR, ' ', TEXT_SIZE);
    for (const radek of zalomSlova(naSlova(text, druh === 'popisek'), TEXT_SIZE, SIRKA)) {
      mistoNeboNova(RADEK);
      let x = LEFT;
      for (const slovo of radek) {
        const font = slovo.tucne ? FONT_BOLD : FONT_REGULAR;
        s.c.text(font, slovo.tucne ? 'FB' : 'FR', slovo.slovo, TEXT_SIZE, x, s.top + 8, INK);
        x += textWidth(font, slovo.slovo, TEXT_SIZE) + mezera;
      }
      s.top += RADEK;
    }
  }

  // --- Podpisy -------------------------------------------------------------
  const BLOK_H = 188;
  mistoNeboNova(BLOK_H + 20);
  s.top += 18;

  const sloupec = (SIRKA - 22) / 2;
  const zacatek = s.top;
  // Popisky u podpisu - stejne jako na strance (zadani 15. 9. 2026).
  const strany: { popisek: string; role: PodpisDoPdf['role'] }[] = [
    { popisek: popisekNaseStrany(data.issuerName).toLocaleUpperCase('cs-CZ'), role: 'MEDIASPACE' },
    { popisek: popisekDruheStrany(data.body).toLocaleUpperCase('cs-CZ'), role: 'PROTISTRANA' },
  ];

  strany.forEach((strana, i) => {
    const x = LEFT + i * (sloupec + 22);
    const podpis = data.podpisy.find((p) => p.role === strana.role) ?? null;

    s.c.text(FONT_BOLD, 'FB', strana.popisek, 8, x, zacatek + 8, PURPLE, 1.2);

    const ramX = x;
    const ramTop = zacatek + 16;
    const ramH = 76;
    s.c.line(ramX, ramTop + ramH, ramX + sloupec, ramTop + ramH, BORDER, 1);

    if (podpis) {
      const obraz = obrazekPodpisu(podpis);
      if (!obraz) {
        // Podpis bez obrazku - to je nas automaticky podpis pri odeslani
        // (zadani 15. 9. 2026). Misto obrazku se napise jmeno; dolozka pod
        // nim je stejna jako u nakresleneho podpisu, takze dukazni hodnota
        // je tataz.
        s.c.text(FONT_BOLD, 'FB', podpis.name, 13, ramX + 4, ramTop + ramH - 10, INK);
      } else {
        const maxH = 68;
        const maxW = sloupec - 8;
        let h = maxH;
        let w = (h * obraz.obraz.width) / obraz.obraz.height;
        if (w > maxW) {
          w = maxW;
          h = (w * obraz.obraz.height) / obraz.obraz.width;
        }
        s.c.image(obraz.klic, ramX + 4, ramTop + ramH - h - 2, w, h);
      }

      const dolozka = [
        podpis.name,
        podpis.email ?? '',
        `Podepsáno ${datumCas(podpis.signedAt)}`,
        podpis.ip ? `IP ${podpis.ip}` : '',
        `Otisk dokumentu ${podpis.documentHash.slice(0, 16).toUpperCase()}`,
      ].filter(Boolean);

      const vyskaDolozky = 12 + dolozka.length * 11;
      s.c.fillRound(ramX, ramTop + ramH + 8, sloupec, vyskaDolozky, 6, 6, TINT);
      let radekTop = ramTop + ramH + 8 + 13;
      dolozka.forEach((radek, poradi) => {
        const font = poradi === 0 ? FONT_BOLD : FONT_REGULAR;
        s.c.text(font, poradi === 0 ? 'FB' : 'FR', radek, 7.2, ramX + 7, radekTop, poradi === 0 ? INK : MUTED);
        radekTop += 11;
      });

      if (podpis.documentHash !== data.currentHash) {
        s.c.text(
          FONT_BOLD,
          'FB',
          'Pozor: text smlouvy se od tohoto podpisu změnil.',
          7,
          ramX,
          radekTop + 4,
          DANGER,
        );
      }
    } else {
      s.c.text(FONT_REGULAR, 'FR', 'zatím nepodepsáno', 8.5, ramX + 2, ramTop + ramH - 6, MUTED);
    }
  });

  s.top = zacatek + BLOK_H;

  // --- Patičky (až teď - dřív nebylo známo, kolik stránek bude) ------------
  stranky.forEach((stranka, i) => {
    const y = PAGE_H - 40;
    stranka.c.line(LEFT, y - 12, RIGHT, y - 12, BORDER, 1);
    stranka.c.text(FONT_BOLD, 'FB', 'Mediaspace', 8, LEFT, y, PURPLE);
    // Oddelovac musi byt znak z podmnoziny vlozeneho fontu - „·" v ni neni
    // a tisklo se „?" (overeno na produkci 15. 9. 2026).
    const cislo = `Smlouva ${data.number} – strana ${i + 1} z ${stranky.length}`;
    stranka.c.text(FONT_REGULAR, 'FR', cislo, 7.5, RIGHT - textWidth(FONT_REGULAR, cislo, 7.5), y, MUTED);
  });

  // --- Složení dokumentu ---------------------------------------------------
  const xobjekty = [`/ImLogo ${logoId} 0 R`, ...obrazky.map((o) => `/${o.klic} ${o.id} 0 R`)].join(' ');
  const pagesId = pdf.reserve();
  const idStranek = stranky.map((stranka) => {
    const contentId = pdf.addStream('/Filter /FlateDecode', deflateSync(stranka.c.toBuffer(), { level: 9 }));
    return pdf.add(
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${f(PAGE_W)} ${f(PAGE_H)}] ` +
        `/Resources << /Font << /FR ${regularId} 0 R /FB ${boldId} 0 R >> ` +
        `/XObject << ${xobjekty} >> >> ` +
        `/Contents ${contentId} 0 R >>`,
    );
  });
  pdf.fill(
    pagesId,
    `<< /Type /Pages /Kids [${idStranek.map((id) => `${id} 0 R`).join(' ')}] /Count ${idStranek.length} >>`,
  );
  const infoId = pdf.add(
    `<< /Title ${pdfText(`Smlouva ${data.number} – ${data.title}`.replace(/[\r\n]+/g, ' '))} ` +
      `/Producer ${pdfText('MEDIA SPACE s.r.o.')} >>`,
  );
  const rootId = pdf.add(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);

  return pdf.build(rootId, infoId);
}

/** Název souboru přílohy - ať je ve schránce poznat, co to je. */
export function nazevSouboruSmlouvy(number: string): string {
  return `Smlouva-${number.replace(/[^\w.-]+/g, '-')}.pdf`;
}
