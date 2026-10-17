/**
 * NOVINKY PORTÁLU - společné číselníky (zadání 17. 10. 2026).
 *
 * Tenhle soubor je schválně bez přístupu do databáze: používají ho i klientské
 * komponenty (formulář novinky, generátor newsletteru). Práce s daty je
 * v lib/novinkyServer.ts.
 */

/** Koho se novinka týká. Pořadí je i pořadím v newsletteru. */
export const PUBLIKA = [
  { kod: 'TYM', label: 'Tým' },
  { kod: 'KLIENT_AUDIOKNIHY', label: 'Klienti – audioknihy' },
  { kod: 'KLIENT_REKLAMY', label: 'Klienti – reklamy' },
  { kod: 'HERCI', label: 'Herci' },
] as const;

export type Publikum = (typeof PUBLIKA)[number]['kod'];

export const KODY_PUBLIK: Publikum[] = PUBLIKA.map((p) => p.kod);

export function labelPublika(kod: string): string {
  return PUBLIKA.find((p) => p.kod === kod)?.label ?? kod;
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

export function labelTypu(kod: string): string {
  return TYPY.find((t) => t.kod === kod)?.label ?? kod;
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

const MESICE = [
  'leden', 'únor', 'březen', 'duben', 'květen', 'červen',
  'červenec', 'srpen', 'září', 'říjen', 'listopad', 'prosinec',
];

/** „říjen 2026" - hlavička skupiny v přehledu i nadpis newsletteru. */
export function mesicTextem(klic: string): string {
  const [rok, mesic] = klic.split('-');
  const index = Number(mesic) - 1;
  if (!rok || index < 0 || index > 11) return klic;
  return `${MESICE[index]} ${rok}`;
}
