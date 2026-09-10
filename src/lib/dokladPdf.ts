import { deflateSync } from 'zlib';
import { FONT_BOLD, FONT_REGULAR, LOGO } from '@/lib/rodnyListAssets';
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
import { computeTotals } from '@/lib/doklady';
import { qrModuly, spdRetezec } from '@/lib/pdf/qrPlatba';

/**
 * Faktury a nabídky do PDF (zadání 10. 9. 2026: „pojďme předělat faktury
 * a nabídky, udělal bych to stejným modelem, rovnou vedle náhled PDF").
 *
 * GRAFIKA: stejná řeč jako Rodný list a naše e-maily - fialová hlavička,
 * zelený akcent, světle fialové plochy - ale klidnější. Faktura nejde jen
 * klientovi, čte ji i účetní a skenuje se; proto žádný gradient přes třetinu
 * stránky a položky v obyčejné, dobře čitelné tabulce.
 *
 * VÍCE STRÁNEK: doklad o dvaceti položkách se na jednu stránku nevejde, takže
 * se sází tokem - když řádky dojdou k patě stránky, založí se další a hlavička
 * tabulky se zopakuje. Souhrn, platební údaje a QR jsou vždy na poslední.
 *
 * POZOR NA TEXTY K DPH: věty o přenesené daňové povinnosti a o plnění mimo
 * předmět daně jsou standardní formulace, ale režim u konkrétního dokladu
 * VYBÍRÁ ČLOVĚK (pole rezimDph) - portál ho nehádá z adresy odběratele.
 */

// --- Barvy (shodné s emailShell v src/lib/email.ts) ------------------------

const PURPLE = hex('#6B2AF0');
const GREEN = hex('#1FDF67');
const INK = hex('#201A33');
const MUTED = hex('#6E6580');
const BORDER = hex('#E4DFFB');
const TINT = hex('#F7F5FF');
const MINT_BG = hex('#E9FFF2');
const GREEN_DARK = hex('#149E4B');

// --- Rozložení -------------------------------------------------------------

const LEFT = 48;
const RIGHT = A4.w - 48;
const SIRKA = RIGHT - LEFT;
const STRED = LEFT + SIRKA / 2 + 6;

const HLAVICKA_H = 104;
const HLAVICKA_DALSI_H = 56;
/**
 * Pod tuhle hranici se už nesází - zbytek jde na další stránku. Nechává nad
 * patičkou (776) pohodlnou mezeru; víc opatrnosti tu znamenalo, že se běžná
 * faktura o čtyřech položkách zlomila na dvě stránky kvůli pár bodům.
 */
const PATA_Y = 758;
const PATICKA_Y = 792;

const RADEK_MIN_H = 26;

// Sloupce tabulky položek (souřadnice pravého okraje u čísel).
const SL_POPIS = LEFT + 12;
const SL_MNOZSTVI = 322;
const SL_CENA = 408;
const SL_DPH = 444;
const SL_CELKEM = RIGHT - 12;
const POPIS_SIRKA = SL_MNOZSTVI - SL_POPIS - 34;

// --- Data ------------------------------------------------------------------

export type StranaDokladu = {
  name: string;
  ic?: string | null;
  dic?: string | null;
  street?: string | null;
  city?: string | null;
  zip?: string | null;
  country?: string | null;
  email?: string | null;
  phone?: string | null;
};

export type PolozkaDokladu = {
  description: string;
  quantity: number;
  unit?: string | null;
  unitPriceMinor: number;
  vatRate: number;
};

export type PlatebniUdaje = {
  ucet?: string | null;
  iban?: string | null;
  swift?: string | null;
  banka?: string | null;
};

/**
 * Režim DPH. Vybírá ho člověk u konkrétního dokladu - portál ho neodvozuje
 * ze země odběratele, protože to je věc účetní, ne adresy.
 */
export type RezimDph = 'STANDARD' | 'PRENESENA' | 'MIMO_PREDMET';

export type DokladData = {
  druh: 'FAKTURA' | 'NABIDKA';
  cislo: string;
  variabilniSymbol?: string | null;
  dodavatel: StranaDokladu;
  dodavatelPlatceDph: boolean;
  odberatel: StranaDokladu;
  polozky: PolozkaDokladu[];
  mena: string;
  datumVystaveni: Date;
  datumPlneni?: Date | null;
  datumSplatnosti?: Date | null;
  /** U nabídky: do kdy platí. */
  platnostDo?: Date | null;
  predmet?: string | null;
  poznamka?: string | null;
  projekt?: string | null;
  platba?: PlatebniUdaje | null;
  rezimDph: RezimDph;
  jazyk: 'cs' | 'en';
};

// --- Slovník ---------------------------------------------------------------

type Slova = Record<string, string>;

const SLOVNIK: Record<'cs' | 'en', Slova> = {
  cs: {
    faktura: 'FAKTURA — DAŇOVÝ DOKLAD',
    fakturaNeplatce: 'FAKTURA',
    nabidka: 'NABÍDKA',
    dodavatel: 'DODAVATEL',
    odberatel: 'ODBĚRATEL',
    ic: 'IČ',
    dic: 'DIČ',
    vystaveno: 'DATUM VYSTAVENÍ',
    duzp: 'DATUM PLNĚNÍ',
    splatnost: 'SPLATNOST',
    platnostDo: 'PLATNOST DO',
    vs: 'VARIABILNÍ SYMBOL',
    predmet: 'PŘEDMĚT',
    projekt: 'PROJEKT',
    popis: 'POPIS',
    mnozstvi: 'MNOŽSTVÍ',
    cena: 'J. CENA',
    dph: 'DPH',
    celkem: 'CELKEM',
    rekapitulace: 'REKAPITULACE DPH',
    sazba: 'SAZBA',
    zaklad: 'ZÁKLAD',
    kUhrade: 'CELKEM K ÚHRADĚ',
    celkemNabidka: 'CELKEM',
    platba: 'PLATEBNÍ ÚDAJE',
    ucet: 'Účet',
    iban: 'IBAN',
    swift: 'SWIFT/BIC',
    qr: 'QR PLATBA',
    qrPopis: 'Načtěte v mobilní bance',
    poznamka: 'POZNÁMKA',
    strana: 'Strana',
    zPokracovani: 'pokračování',
    neplatce: 'Nejsme plátci DPH.',
    prenesena: 'Daň odvede zákazník — přenesená daňová povinnost.',
    mimoPredmet: 'Plnění není předmětem DPH v České republice — místo plnění je ve státě příjemce.',
  },
  en: {
    faktura: 'INVOICE — TAX DOCUMENT',
    fakturaNeplatce: 'INVOICE',
    nabidka: 'QUOTATION',
    dodavatel: 'SUPPLIER',
    odberatel: 'CUSTOMER',
    ic: 'Company ID',
    dic: 'VAT ID',
    vystaveno: 'ISSUE DATE',
    duzp: 'DATE OF SUPPLY',
    splatnost: 'DUE DATE',
    platnostDo: 'VALID UNTIL',
    vs: 'VARIABLE SYMBOL',
    predmet: 'SUBJECT',
    projekt: 'PROJECT',
    popis: 'DESCRIPTION',
    mnozstvi: 'QUANTITY',
    cena: 'UNIT PRICE',
    dph: 'VAT',
    celkem: 'TOTAL',
    rekapitulace: 'VAT SUMMARY',
    sazba: 'RATE',
    zaklad: 'BASE',
    kUhrade: 'TOTAL DUE',
    celkemNabidka: 'TOTAL',
    platba: 'PAYMENT DETAILS',
    ucet: 'Account',
    iban: 'IBAN',
    swift: 'SWIFT/BIC',
    qr: 'QR PAYMENT',
    qrPopis: 'Scan in your banking app',
    poznamka: 'NOTE',
    strana: 'Page',
    zPokracovani: 'continued',
    neplatce: 'Not a VAT payer.',
    prenesena: 'Reverse charge — VAT to be accounted for by the recipient.',
    mimoPredmet: 'Not subject to Czech VAT — the place of supply is in the recipient country.',
  },
};

// --- Formátování -----------------------------------------------------------

/**
 * Částka i datum se formátují přes Intl, ale všechny druhy mezer se pak
 * srovnají na obyčejnou - úzká nezlomitelná mezera v ořezaném písmu není
 * a vypadla by z dokumentu jako otazník.
 */
function mezery(text: string): string {
  return text.replace(/[    ]/g, ' ');
}

function castka(minor: number, mena: string, jazyk: 'cs' | 'en'): string {
  const hodnota = minor / 100;
  try {
    return mezery(
      new Intl.NumberFormat(jazyk === 'cs' ? 'cs-CZ' : 'en-GB', {
        style: 'currency',
        currency: mena,
        minimumFractionDigits: 2,
      }).format(hodnota),
    );
  } catch {
    return `${hodnota.toFixed(2)} ${mena}`;
  }
}

function cislo(hodnota: number, jazyk: 'cs' | 'en'): string {
  return mezery(
    new Intl.NumberFormat(jazyk === 'cs' ? 'cs-CZ' : 'en-GB', { maximumFractionDigits: 3 }).format(hodnota),
  );
}

function datum(hodnota: Date | null | undefined, jazyk: 'cs' | 'en'): string {
  if (!hodnota) return '—';
  return mezery(
    new Intl.DateTimeFormat(jazyk === 'cs' ? 'cs-CZ' : 'en-GB', {
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
      timeZone: 'Europe/Prague',
    }).format(hodnota),
  );
}

/** Adresa strany dokladu na řádky. */
function adresa(strana: StranaDokladu): string[] {
  const radky: string[] = [];
  if (strana.street) radky.push(strana.street);
  const mesto = [strana.zip, strana.city].filter(Boolean).join(' ');
  if (mesto) radky.push(mesto);
  if (strana.country && strana.country.toUpperCase() !== 'CZ') radky.push(strana.country);
  return radky;
}

/** Zalomí text do dané šířky. Nikdy nevrací prázdno. */
function zalom(text: string, sirka: number, velikost: number, tucne = false): string[] {
  const font = tucne ? FONT_BOLD : FONT_REGULAR;
  const slova = text.split(/\s+/).filter(Boolean);
  if (slova.length === 0) return [''];
  const radky: string[] = [];
  let radek = '';
  for (const slovo of slova) {
    const zkouska = radek ? `${radek} ${slovo}` : slovo;
    if (textWidth(font, zkouska, velikost) <= sirka || !radek) {
      radek = zkouska;
    } else {
      radky.push(radek);
      radek = slovo;
    }
  }
  if (radek) radky.push(radek);
  return radky;
}

// --- Kreslení --------------------------------------------------------------

/** Text zarovnaný doprava k dané souřadnici. */
function vpravo(
  c: Kresba,
  tucne: boolean,
  text: string,
  velikost: number,
  xKonec: number,
  zakladna: number,
  barva: RGB,
) {
  const font = tucne ? FONT_BOLD : FONT_REGULAR;
  c.text(font, tucne ? 'FB' : 'FR', text, velikost, xKonec - textWidth(font, text, velikost), zakladna, barva);
}

function popisek(c: Kresba, text: string, x: number, zakladna: number, barva = MUTED) {
  c.text(FONT_BOLD, 'FB', text, 7.5, x, zakladna, barva, 0.8);
}

/** Fialová hlavička. Na dalších stránkách je nižší a nese jen číslo dokladu. */
function hlavicka(c: Kresba, data: DokladData, s: Slova, prvni: boolean): number {
  const vyska = prvni ? HLAVICKA_H : HLAVICKA_DALSI_H;
  c.fillRect(0, 0, A4.w, vyska, PURPLE);

  const logoV = prvni ? 28 : 20;
  c.image('ImLogo', LEFT, prvni ? 34 : 18, (logoV * LOGO.width) / LOGO.height, logoV);

  const nazev =
    data.druh === 'NABIDKA' ? s.nabidka : data.dodavatelPlatceDph ? s.faktura : s.fakturaNeplatce;

  if (prvni) {
    c.fillRound(LEFT, 74, 40, 3, 1.5, 1.5, GREEN);
    vpravo(c, true, nazev, 10, RIGHT, 50, hex('#C9FFDF'));
    vpravo(c, true, data.cislo, 22, RIGHT, 82, BILA);
  } else {
    vpravo(c, true, `${nazev} ${data.cislo} — ${s.zPokracovani}`, 9, RIGHT, 36, hex('#C9FFDF'));
  }

  return vyska;
}

/** Dodavatel vlevo, odběratel vpravo. Vrací spodní hranu bloku. */
function strany(c: Kresba, data: DokladData, s: Slova): number {
  const vrch = HLAVICKA_H + 24;
  let nejnizsi = vrch;

  for (const [x, popis, strana] of [
    [LEFT, s.dodavatel, data.dodavatel] as const,
    [STRED, s.odberatel, data.odberatel] as const,
  ]) {
    popisek(c, popis, x, vrch);
    let y = vrch + 20;
    for (const radek of zalom(strana.name, SIRKA / 2 - 20, 12, true)) {
      c.text(FONT_BOLD, 'FB', radek, 12, x, y, INK);
      y += 15;
    }
    y += 1;
    for (const radek of adresa(strana)) {
      c.text(FONT_REGULAR, 'FR', radek, 9.5, x, y, MUTED);
      y += 12.5;
    }
    const identifikace = [
      strana.ic ? `${s.ic}: ${strana.ic}` : null,
      strana.dic ? `${s.dic}: ${strana.dic}` : null,
    ].filter(Boolean) as string[];
    if (identifikace.length > 0) {
      y += 3;
      c.text(FONT_REGULAR, 'FR', identifikace.join('   •   '), 9.5, x, y, INK);
      y += 13;
    }
    nejnizsi = Math.max(nejnizsi, y);
  }

  return nejnizsi;
}

/** Pruh s daty a variabilním symbolem. */
function pruhUdaju(c: Kresba, data: DokladData, s: Slova, vrch: number): number {
  const bunky: { popis: string; hodnota: string }[] = [
    { popis: s.vystaveno, hodnota: datum(data.datumVystaveni, data.jazyk) },
  ];
  if (data.druh === 'FAKTURA') {
    if (data.datumPlneni) bunky.push({ popis: s.duzp, hodnota: datum(data.datumPlneni, data.jazyk) });
    bunky.push({ popis: s.splatnost, hodnota: datum(data.datumSplatnosti, data.jazyk) });
    if (data.variabilniSymbol) bunky.push({ popis: s.vs, hodnota: data.variabilniSymbol });
  } else if (data.platnostDo) {
    bunky.push({ popis: s.platnostDo, hodnota: datum(data.platnostDo, data.jazyk) });
  }

  const vyska = 48;
  c.fillRound(LEFT, vrch, SIRKA, vyska, 10, 10, TINT);
  const sirkaBunky = SIRKA / bunky.length;
  bunky.forEach((bunka, i) => {
    const x = LEFT + i * sirkaBunky + 14;
    popisek(c, bunka.popis, x, vrch + 18);
    c.text(FONT_BOLD, 'FB', bunka.hodnota, 11, x, vrch + 36, INK);
    if (i > 0) c.line(LEFT + i * sirkaBunky, vrch + 10, LEFT + i * sirkaBunky, vrch + vyska - 10, BORDER, 1);
  });

  return vrch + vyska;
}

/** Hlavička tabulky položek. Opakuje se na každé stránce. */
function hlavickaTabulky(c: Kresba, s: Slova, vrch: number, sDph: boolean): number {
  const vyska = 24;
  c.fillRound(LEFT, vrch, SIRKA, vyska, 8, 0, TINT);
  const zakladna = vrch + 15.5;
  popisek(c, s.popis, SL_POPIS, zakladna);
  vpravo(c, true, s.mnozstvi, 7.5, SL_MNOZSTVI, zakladna, MUTED);
  vpravo(c, true, s.cena, 7.5, SL_CENA, zakladna, MUTED);
  if (sDph) vpravo(c, true, s.dph, 7.5, SL_DPH, zakladna, MUTED);
  vpravo(c, true, s.celkem, 7.5, SL_CELKEM, zakladna, MUTED);
  c.line(LEFT, vrch + vyska, RIGHT, vrch + vyska, BORDER, 1);
  return vrch + vyska;
}

/** Souhrn, platební údaje s QR a poznámky. Vrací spodní hranu. */
function zaver(
  c: Kresba,
  data: DokladData,
  s: Slova,
  vrch: number,
  soucty: ReturnType<typeof computeTotals>,
  sDph: boolean,
): number {
  let y = vrch + 12;

  // Rekapitulace DPH vlevo, souhrn vpravo.
  const souhrnX = STRED;
  let ySouhrn = y;

  if (sDph && soucty.byRate.length > 0) {
    popisek(c, s.rekapitulace, LEFT, y + 8);
    let yr = y + 24;
    c.line(LEFT, yr, souhrnX - 20, yr, BORDER, 1);
    yr += 14;
    popisek(c, s.sazba, LEFT, yr, MUTED);
    vpravo(c, true, s.zaklad, 7.5, souhrnX - 100, yr, MUTED);
    vpravo(c, true, s.dph, 7.5, souhrnX - 20, yr, MUTED);
    yr += 6;
    for (const sazba of soucty.byRate) {
      yr += 16;
      c.text(FONT_REGULAR, 'FR', `${sazba.rate} %`, 9.5, LEFT, yr, INK);
      vpravo(c, false, castka(sazba.base, data.mena, data.jazyk), 9.5, souhrnX - 100, yr, INK);
      vpravo(c, false, castka(sazba.vat, data.mena, data.jazyk), 9.5, souhrnX - 20, yr, INK);
    }
    y = Math.max(y, yr + 10);
  }

  // Souhrn.
  if (sDph) {
    popisek(c, s.zaklad, souhrnX, ySouhrn + 8);
    vpravo(c, false, castka(soucty.exVat, data.mena, data.jazyk), 10.5, RIGHT, ySouhrn + 8, INK);
    popisek(c, s.dph, souhrnX, ySouhrn + 26);
    vpravo(c, false, castka(soucty.vat, data.mena, data.jazyk), 10.5, RIGHT, ySouhrn + 26, INK);
    ySouhrn += 38;
  }

  const vyskaCelkem = 46;
  c.fillRound(souhrnX, ySouhrn, RIGHT - souhrnX, vyskaCelkem, 10, 10, PURPLE);
  c.text(
    FONT_BOLD,
    'FB',
    data.druh === 'FAKTURA' ? s.kUhrade : s.celkemNabidka,
    7.5,
    souhrnX + 14,
    ySouhrn + 18,
    hex('#C9FFDF'),
    0.8,
  );
  vpravo(c, true, castka(soucty.incVat, data.mena, data.jazyk), 16, RIGHT - 14, ySouhrn + 36, BILA);
  y = Math.max(y, ySouhrn + vyskaCelkem);

  // Věta k režimu DPH.
  if (data.rezimDph !== 'STANDARD' || !data.dodavatelPlatceDph) {
    y += 20;
    const veta =
      data.rezimDph === 'PRENESENA'
        ? s.prenesena
        : data.rezimDph === 'MIMO_PREDMET'
          ? s.mimoPredmet
          : s.neplatce;
    const radky = zalom(veta, SIRKA - 28, 9.5);
    c.fillRound(LEFT, y, SIRKA, 16 + radky.length * 13, 10, 10, MINT_BG);
    let yv = y + 18;
    for (const radek of radky) {
      c.text(FONT_BOLD, 'FB', radek, 9.5, LEFT + 14, yv, GREEN_DARK);
      yv += 13;
    }
    y = yv;
  }

  // Platební údaje a QR - jen u faktury.
  if (data.druh === 'FAKTURA' && data.platba) {
    y += 26;
    popisek(c, s.platba, LEFT, y);
    let yp = y + 18;
    const radky: [string, string][] = [];
    if (data.platba.ucet) radky.push([s.ucet, data.platba.ucet]);
    if (data.platba.iban) radky.push([s.iban, data.platba.iban]);
    if (data.platba.swift) radky.push([s.swift, data.platba.swift]);
    for (const [popis, hodnota] of radky) {
      c.text(FONT_REGULAR, 'FR', popis, 9.5, LEFT, yp, MUTED);
      c.text(FONT_BOLD, 'FB', hodnota, 10.5, LEFT + 62, yp, INK);
      yp += 16;
    }

    const kod = data.platba.iban
      ? spdRetezec({
          iban: data.platba.iban,
          castkaMinor: soucty.incVat,
          mena: data.mena,
          variabilniSymbol: data.variabilniSymbol,
          zprava: `${data.cislo} ${data.dodavatel.name}`,
          splatnost: data.datumSplatnosti ?? null,
          swift: data.platba.swift,
        })
      : null;

    if (kod) {
      const strana = 84;
      const x = RIGHT - strana;
      const { velikost, body } = qrModuly(kod);
      const modul = strana / velikost;
      // Bílý podklad je součást kódu - čtečky počítají s tmavým na světlém.
      c.fillRect(x - 6, y - 4, strana + 12, strana + 12, BILA);
      for (let r = 0; r < velikost; r += 1) {
        for (let sl = 0; sl < velikost; sl += 1) {
          if (body[r * velikost + sl]) {
            // Čtverečky se kreslí o chlup větší, aby mezi nimi nezůstaly
            // vlásečnicové mezery, kterými některé čtečky pohrdají.
            c.fillRect(x + sl * modul, y - 4 + r * modul, modul + 0.2, modul + 0.2, hex('#14121A'));
          }
        }
      }
      popisek(c, s.qr, x, y + strana + 6);
      c.text(FONT_REGULAR, 'FR', s.qrPopis, 8, x, y + strana + 17, MUTED);
      yp = Math.max(yp, y + strana + 20);
    }
    y = yp;
  }

  if (data.poznamka) {
    y += 16;
    popisek(c, s.poznamka, LEFT, y);
    y += 16;
    for (const radek of zalom(data.poznamka, SIRKA, 9.5)) {
      c.text(FONT_REGULAR, 'FR', radek, 9.5, LEFT, y, INK);
      y += 13;
    }
  }

  return y;
}

/**
 * Kolik místa zabere závěr (rekapitulace, souhrn, věta k DPH, platební údaje
 * s QR a poznámka). Drží se stejných čísel jako zaver() - kdo mění jedno,
 * ať zkontroluje druhé.
 */
function vyskaZaveru(
  data: DokladData,
  s: Slova,
  soucty: ReturnType<typeof computeTotals>,
  sDph: boolean,
): number {
  let vyska = 12;

  const rekapitulace = sDph && soucty.byRate.length > 0 ? 44 + soucty.byRate.length * 16 + 10 : 0;
  const souhrn = (sDph ? 38 : 0) + 46;
  vyska += Math.max(rekapitulace, souhrn);

  if (data.rezimDph !== 'STANDARD' || !data.dodavatelPlatceDph) {
    const veta =
      data.rezimDph === 'PRENESENA' ? s.prenesena : data.rezimDph === 'MIMO_PREDMET' ? s.mimoPredmet : s.neplatce;
    vyska += 20 + 16 + zalom(veta, SIRKA - 28, 9.5).length * 13;
  }

  if (data.druh === 'FAKTURA' && data.platba) {
    const radky = [data.platba.ucet, data.platba.iban, data.platba.swift].filter(Boolean).length;
    const udaje = 18 + radky * 16;
    const qr = data.platba.iban ? 84 + 20 : 0;
    vyska += 26 + Math.max(udaje, qr);
  }

  if (data.poznamka) vyska += 16 + 16 + zalom(data.poznamka, SIRKA, 9.5).length * 13;

  return vyska;
}

// --- Sazba celého dokumentu ------------------------------------------------

/**
 * Vyrobí hotové PDF faktury nebo nabídky.
 *
 * Nikdy nevyhazuje kvůli obsahu dat - dlouhý text se zalomí, chybějící údaj se
 * vynechá. Doklad se generuje i do náhledu, který se překresluje při psaní,
 * takže nesmí spadnout na rozepsané hodnotě.
 */
export function renderDokladPdf(data: DokladData): Buffer {
  const pdf = new PdfWriter();
  const regularId = embedFont(pdf, FONT_REGULAR, 'LiberationSans');
  const boldId = embedFont(pdf, FONT_BOLD, 'LiberationSans-Bold');
  const logoId = embedImage(pdf, LOGO);

  const s = SLOVNIK[data.jazyk];
  const prenesena = data.rezimDph !== 'STANDARD';
  // V přeneseném režimu se sazby u položek ignorují - doklad je bez daně a
  // důvod se píše větou pod souhrnem. Jinak by se muselo u každé položky ručně
  // přepisovat DPH na nulu.
  const polozky = prenesena ? data.polozky.map((p) => ({ ...p, vatRate: 0 })) : data.polozky;
  const sDph = data.dodavatelPlatceDph && !prenesena;
  const soucty = computeTotals(
    polozky.map((p) => ({ quantity: p.quantity, unitPriceMinor: p.unitPriceMinor, vatRate: p.vatRate })),
  );

  const stranky: Kresba[] = [];
  let c = new Kresba(A4.h);
  stranky.push(c);

  hlavicka(c, data, s, true);
  let y = strany(c, data, s);
  y = pruhUdaju(c, data, s, y + 16);

  // Predmet a projekt jsou vedle sebe, ne pod sebou - kazdy radek navic tlaci
  // zaver dokladu na druhou stranku.
  if (data.predmet || data.projekt) {
    y += 20;
    const sloupce = [
      data.predmet ? { x: LEFT, sirka: STRED - LEFT - 20, popis: s.predmet, hodnota: data.predmet } : null,
      data.projekt ? { x: STRED, sirka: RIGHT - STRED, popis: s.projekt, hodnota: data.projekt } : null,
    ].filter(Boolean) as { x: number; sirka: number; popis: string; hodnota: string }[];
    let nejnizsi = y;
    for (const sloupec of sloupce) {
      popisek(c, sloupec.popis, sloupec.x, y);
      let ys = y;
      for (const radek of zalom(sloupec.hodnota, sloupec.sirka, 11)) {
        ys += 15;
        c.text(FONT_BOLD, 'FB', radek, 11, sloupec.x, ys, INK);
      }
      nejnizsi = Math.max(nejnizsi, ys);
    }
    y = nejnizsi;
  }

  y = hlavickaTabulky(c, s, y + 20, sDph);

  /** Založí další stránku a zopakuje hlavičku tabulky. */
  function dalsiStranka(): number {
    c = new Kresba(A4.h);
    stranky.push(c);
    hlavicka(c, data, s, false);
    return hlavickaTabulky(c, s, HLAVICKA_DALSI_H + 26, sDph);
  }

  for (const polozka of polozky) {
    const radkyPopisu = zalom(polozka.description || '—', POPIS_SIRKA, 10);
    const vyska = Math.max(RADEK_MIN_H, 12 + radkyPopisu.length * 13);
    if (y + vyska > PATA_Y) y = dalsiStranka();

    const zakladna = y + 17;
    let yp = zakladna;
    for (const radek of radkyPopisu) {
      c.text(FONT_REGULAR, 'FR', radek, 10, SL_POPIS, yp, INK);
      yp += 13;
    }

    const mnozstvi = `${cislo(polozka.quantity, data.jazyk)}${polozka.unit ? ` ${polozka.unit}` : ''}`;
    vpravo(c, false, mnozstvi, 10, SL_MNOZSTVI, zakladna, MUTED);
    vpravo(c, false, castka(polozka.unitPriceMinor, data.mena, data.jazyk), 10, SL_CENA, zakladna, MUTED);
    if (sDph) vpravo(c, false, `${polozka.vatRate} %`, 10, SL_DPH, zakladna, MUTED);
    vpravo(
      c,
      true,
      castka(Math.round(polozka.quantity * polozka.unitPriceMinor), data.mena, data.jazyk),
      10.5,
      SL_CELKEM,
      zakladna,
      INK,
    );

    y += vyska;
    c.line(LEFT, y, RIGHT, y, BORDER, 1);
  }

  // Souhrn se nesmí utrhnout od tabulky - když se nevejde, jde celý na další
  // stránku. Výška se počítá, ne odhaduje: paušální rezerva lámala stránku
  // i tam, kde se závěr pohodlně vešel.
  if (y + vyskaZaveru(data, s, soucty, sDph) > PATA_Y) {
    c = new Kresba(A4.h);
    stranky.push(c);
    hlavicka(c, data, s, false);
    y = HLAVICKA_DALSI_H + 20;
  }
  zaver(c, data, s, y, soucty, sDph);

  // Patička se dokresluje až teď - dřív se neví, kolik stránek doklad má.
  stranky.forEach((stranka, i) => {
    stranka.line(LEFT, PATICKA_Y - 16, RIGHT, PATICKA_Y - 16, BORDER, 1);
    const podpis = [data.dodavatel.name, data.dodavatel.email, data.dodavatel.phone].filter(Boolean).join('   •   ');
    stranka.text(FONT_REGULAR, 'FR', podpis, 8.5, LEFT, PATICKA_Y, MUTED);
    vpravo(stranka, false, `${s.strana} ${i + 1}/${stranky.length}`, 8.5, RIGHT, PATICKA_Y, MUTED);
  });

  // Složení dokumentu.
  const pagesId = pdf.reserve();
  const zdroje =
    `/Resources << /Font << /FR ${regularId} 0 R /FB ${boldId} 0 R >> ` +
    `/XObject << /ImLogo ${logoId} 0 R >> >>`;
  const ids = stranky.map((stranka) => {
    const contentId = pdf.addStream('/Filter /FlateDecode', deflateSync(stranka.toBuffer(), { level: 9 }));
    return pdf.add(
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${f(A4.w)} ${f(A4.h)}] ${zdroje} ` +
        `/Contents ${contentId} 0 R >>`,
    );
  });
  pdf.fill(pagesId, `<< /Type /Pages /Kids [${ids.map((id) => `${id} 0 R`).join(' ')}] /Count ${ids.length} >>`);

  const nazev = `${data.druh === 'FAKTURA' ? 'Faktura' : 'Nabídka'} ${data.cislo}`;
  const infoId = pdf.add(
    `<< /Title ${pdfText(nazev.replace(/[\r\n]+/g, ' '))} /Producer ${pdfText('MEDIA SPACE s.r.o.')} >>`,
  );
  const rootId = pdf.add(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
  return pdf.build(rootId, infoId);
}

/** Název souboru: "Faktura_2026001.pdf". */
export function dokladFileName(druh: 'FAKTURA' | 'NABIDKA', cislo: string): string {
  const zaklad = cislo
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
  return `${druh === 'FAKTURA' ? 'Faktura' : 'Nabidka'}_${zaklad || 'doklad'}.pdf`;
}
