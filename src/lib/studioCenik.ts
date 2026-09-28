import type { Currency } from '@prisma/client';
import { CURRENCY_LABELS } from '@/lib/doklady';

/**
 * CENÍK STUDIA (zadání 28. 9. 2026: „potřeboval bych někde v rámci Londýnského
 * studia implementovat na portál tento ceník. Aby se daly upravovat ceny
 * v systému a aby se pak dalo poslat někomu PDF nebo stáhnout.").
 *
 * Tenhle soubor je BEZ Prismy - používá ho editor v prohlížeči, server i sazba
 * PDF, aby se cena nikde nevykreslila jinak než jinde.
 *
 * CENY JSOU V NEJMENŠÍ JEDNOTCE MĚNY (pence, haléře), stejně jako u dokladů.
 * Libra se píše jako „£70" bez haléřů, když je částka celá - ceník s „£70.00"
 * vypadá jako faktura, ne jako nabídka. Když celá není, desetiny se dopíšou.
 */

export type RadekCeniku = {
  id: string;
  popis: string;
  cena1Minor: number | null;
  cena2Minor: number | null;
  od1: boolean;
  od2: boolean;
};

export type Cenik = {
  nadpis: string;
  podnadpis: string | null;
  /** „YYYY-MM-DD" nebo prázdno - platnost se pak neuvádí. */
  platnostDo: string;
  mena: Currency;
  sloupec1: string;
  sloupec1Popis: string | null;
  sloupec2: string | null;
  sloupec2Popis: string | null;
  poznamka: string | null;
  radky: RadekCeniku[];
};

/**
 * Částka do tabulky: „£70", „£12.50", „from £100". Prázdná cena je pomlčka -
 * u „Mix a mastering" bez technika není co nabídnout a nula by lhala.
 */
export function cena(minor: number | null, mena: Currency, od = false): string {
  if (minor === null || minor === undefined) return '—';
  const znak = CURRENCY_LABELS[mena];
  const cele = minor % 100 === 0;
  const cislo = cele ? String(minor / 100) : (minor / 100).toFixed(2);
  // Koruna se píše za číslo, libra, euro i dolar před něj.
  const castka = mena === 'CZK' ? `${cislo} ${znak}` : `${znak}${cislo}`;
  return od ? `from ${castka}` : castka;
}

/** „31 December 2026" - ceník je anglicky, takže i datum. */
export function platnost(datum: Date | string | null): string {
  if (!datum) return '';
  const d = typeof datum === 'string' ? new Date(`${datum}T12:00:00Z`) : datum;
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(d);
}

/**
 * VÝCHOZÍ CENÍK LONDÝNA - přesně to, co bylo ve wordu
 * MS_STUDIO_LONDON_PRICE_LIST_MUSIC.docx (28. 9. 2026).
 *
 * Používá se JEN při prvním otevření ceníku studia, které ho ještě nemá.
 * Od té chvíle je zdrojem pravdy databáze a změna tady se do už založeného
 * ceníku nepromítne - jinak by úprava kódu přepsala ceny, které mezitím někdo
 * ručně změnil.
 */
export const VYCHOZI_CENIK_LONDYN: Omit<Cenik, 'radky'> & {
  radky: Omit<RadekCeniku, 'id'>[];
} = {
  nadpis: 'MS STUDIO LONDON',
  podnadpis: 'Introductory Price List',
  platnostDo: '2026-12-31',
  mena: 'GBP',
  sloupec1: 'Without engineer',
  sloupec1Popis: 'Suitable for self-recording, podcasts, voiceovers and content creation.',
  sloupec2: 'With engineer',
  sloupec2Popis:
    'Includes recording support, microphone setup and technical assistance during the session.',
  poznamka: null,
  radky: [
    { popis: '1 hour', cena1Minor: 2500, cena2Minor: 4000, od1: false, od2: false },
    { popis: 'Half day / 4 hours', cena1Minor: 7000, cena2Minor: 12000, od1: false, od2: false },
    { popis: 'Full day / 8 hours', cena1Minor: 12000, cena2Minor: 20000, od1: false, od2: false },
    { popis: 'Mix and mastering', cena1Minor: null, cena2Minor: 10000, od1: false, od2: true },
  ],
};

/** Prázdný ceník pro studio, které vzor Londýna nechce. */
export const PRAZDNY_CENIK: Omit<Cenik, 'radky'> & { radky: Omit<RadekCeniku, 'id'>[] } = {
  nadpis: 'Price List',
  podnadpis: null,
  platnostDo: '',
  mena: 'CZK',
  sloupec1: 'Cena',
  sloupec1Popis: null,
  sloupec2: null,
  sloupec2Popis: null,
  poznamka: null,
  radky: [{ popis: '1 hodina', cena1Minor: null, cena2Minor: null, od1: false, od2: false }],
};

/** „MS_Studio_London_Price_List.pdf" */
export function cenikFileName(nadpis: string): string {
  const cisti = nadpis
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
  return `${cisti || 'Price_List'}_Price_List.pdf`;
}
