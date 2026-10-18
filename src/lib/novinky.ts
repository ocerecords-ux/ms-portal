/**
 * NOVINKY PORTÁLU - společné číselníky (zadání 17. 10. 2026).
 *
 * Tenhle soubor je schválně bez přístupu do databáze: používají ho i klientské
 * komponenty (formulář novinky, generátor newsletteru). Práce s daty je
 * v lib/novinkyServer.ts.
 */

import { kodJazyka, prelozit, type Jazyk } from '@/lib/jazyk';

/** Koho se novinka týká. Pořadí je i pořadím v newsletteru. */
export const PUBLIKA = [
  { kod: 'TYM', label: 'Tým' },
  { kod: 'KLIENT_AUDIOKNIHY', label: 'Klienti – audioknihy' },
  { kod: 'KLIENT_REKLAMY', label: 'Klienti – reklamy' },
  { kod: 'HERCI', label: 'Herci' },
] as const;

export type Publikum = (typeof PUBLIKA)[number]['kod'];

export const KODY_PUBLIK: Publikum[] = PUBLIKA.map((p) => p.kod);

/**
 * Název publika podle KÓDU (dávka 7o). Jazyk je nepovinný a bez něj zůstává
 * čeština zdrojem pravdy - vzor `textSekce` z dávky 7d. Newsletter si ho tedy
 * nebere: ten se řídí jazykem příjemce, ne přepínačem v liště (pravidlo 5).
 */
export function labelPublika(kod: string, jazyk?: Jazyk): string {
  const zaloha = PUBLIKA.find((p) => p.kod === kod)?.label ?? kod;
  if (!jazyk || jazyk === 'cs') return zaloha;
  const klic = `novinky.publikum.${kod}`;
  const text = prelozit(jazyk, klic);
  return text === klic ? zaloha : text;
}

/**
 * Druh novinky. „MODUL" je nová část portálu, „VYLEPSENI" vychytávka
 * ve stávající, „OPRAVA" náprava něčeho, co nefungovalo. V newsletteru se
 * drží tohle pořadí - nejdřív to velké.
 */
export const TYPY = [
  { kod: 'MODUL', label: 'Nový modul', kratce: 'Modul' },
  { kod: 'VYLEPSENI', label: 'Vylepšení', kratce: 'Vylepšení' },
  { kod: 'OPRAVA', label: 'Oprava', kratce: 'Oprava' },
] as const;

export type TypNovinky = (typeof TYPY)[number]['kod'];

export const KODY_TYPU: TypNovinky[] = TYPY.map((t) => t.kod);

/** Název druhu novinky podle KÓDU (dávka 7o), stejný vzor jako `labelPublika`. */
export function labelTypu(kod: string, jazyk?: Jazyk): string {
  const zaloha = TYPY.find((t) => t.kod === kod)?.label ?? kod;
  if (!jazyk || jazyk === 'cs') return zaloha;
  const klic = `novinky.typ.${kod}`;
  const text = prelozit(jazyk, klic);
  return text === klic ? zaloha : text;
}

/**
 * Barva štítku typu. Zelená je naše akcentní - na ni se píše text-onAccent,
 * nikdy bílá.
 */
export function barvaTypu(kod: string): string {
  if (kod === 'MODUL') return 'bg-accent text-onAccent';
  if (kod === 'OPRAVA') return 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200';
  return 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-100';
}

/**
 * Stálý klíč novinky. Novinky psané rukou v portálu ho mají z data a názvu,
 * zpětně doplněná historie z vlastního seznamu - díky němu se při nasazení
 * nezaloží podruhé.
 */
export function klicNovinky(datum: Date, nazev: string): string {
  const den = datum.toISOString().slice(0, 10);
  const jmeno = nazev
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `${den}-${jmeno || 'novinka'}`;
}

/** Měsíc jako „2026-10" - tím se novinky seskupují v přehledu i v newsletteru. */
export function mesicKlice(datum: Date): string {
  return `${datum.getFullYear()}-${String(datum.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * „říjen 2026" / „October 2026" - hlavička skupiny v přehledu i nadpis
 * newsletteru. Názvy měsíců byly do dávky 7o napsané česky v poli; teď je
 * skládá `Intl` podle jazyka a čeština vychází stejně jako dřív. Bez jazyka
 * zůstává čeština - newsletter se řídí jazykem příjemce (pravidlo 5).
 */
export function mesicTextem(klic: string, jazyk?: Jazyk): string {
  const [rok, mesic] = klic.split('-');
  const index = Number(mesic) - 1;
  if (!rok || index < 0 || index > 11) return klic;
  const nazev = new Intl.DateTimeFormat(kodJazyka(jazyk ?? 'cs'), { month: 'long' }).format(
    new Date(Date.UTC(2000, index, 1)),
  );
  return `${nazev} ${rok}`;
}
