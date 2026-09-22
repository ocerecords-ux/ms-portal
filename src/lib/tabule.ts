/**
 * TABULE VE STUDIÍCH (zadání 21. 9. 2026: „tabule ve studiích na obrazovkách…
 * datum + události z kalendáře na dnešní den v daném studiu… poznámky a aby
 * tam mohli lidi vkládat symboly, co chybí ve studiu. Bude to dotykový
 * displej").
 *
 * Soubor je bez Prismy - sdílí ho tabule v prohlížeči i server.
 */

export type PolozkaTabule = {
  klic: string;
  nazev: string;
  /** Vnitřek SVG ve viewBoxu 0 0 40 40, tah currentColor. */
  svg: string;
};

/** Co jde na tabuli nahlásit, že chybí. Další položka = jeden řádek sem. */
export const POLOZKY_TABULE: PolozkaTabule[] = [
  {
    klic: 'kava',
    nazev: 'Káva',
    svg: '<path d="M6 12h24v10a10 10 0 0 1-10 10h-4A10 10 0 0 1 6 22V12z"/><path d="M30 15h3a5 5 0 0 1 0 10h-3"/><path d="M12 4c0 2 2 2 2 4M18 4c0 2 2 2 2 4M24 4c0 2 2 2 2 4"/><path d="M4 38h30"/>',
  },
  {
    klic: 'toaletak',
    nazev: 'Toaletní papír',
    svg: '<ellipse cx="14" cy="12" rx="9" ry="7"/><ellipse cx="14" cy="12" rx="3" ry="2.3"/><path d="M5 12v18c0 4 4 7 9 7s9-3 9-7V12"/><path d="M23 30h14v8H18"/>',
  },
  {
    klic: 'kapesniky',
    nazev: 'Kapesníky',
    svg: '<rect x="5" y="18" width="30" height="18" rx="3"/><path d="M13 18c0-6 3-11 7-11s7 5 7 11"/><path d="M5 25h30"/>',
  },
  {
    klic: 'voda',
    nazev: 'Voda',
    svg: '<path d="M16 4h8v5l3 4v23a3 3 0 0 1-3 3h-8a3 3 0 0 1-3-3V13l3-4V4z"/><path d="M13 20h14M13 28h14"/>',
  },
  {
    klic: 'mleko',
    nazev: 'Mléko',
    svg: '<path d="M13 4h14v6l4 6v20a2 2 0 0 1-2 2H11a2 2 0 0 1-2-2V16l4-6V4z"/><path d="M13 10h14M9 22h22"/>',
  },
  {
    klic: 'caj',
    nazev: 'Čaj',
    svg: '<path d="M8 16h22v8a10 10 0 0 1-10 10h-2A10 10 0 0 1 8 24v-8z"/><path d="M30 18h2a4 4 0 0 1 0 8h-2"/><path d="M19 16V6"/><rect x="15" y="4" width="8" height="6" rx="1"/><path d="M5 38h28"/>',
  },
  {
    klic: 'cukr',
    nazev: 'Cukr',
    svg: '<rect x="6" y="20" width="13" height="13" rx="2"/><rect x="21" y="20" width="13" height="13" rx="2"/><rect x="13" y="6" width="13" height="13" rx="2"/>',
  },
  {
    klic: 'baterie',
    nazev: 'Baterie',
    svg: '<rect x="5" y="12" width="28" height="16" rx="3"/><path d="M33 17h3v6h-3"/><path d="M11 20h6M14 17v6M22 20h5"/>',
  },
  {
    klic: 'uklid',
    nazev: 'Úklid',
    svg: '<path d="M26 4 18 22"/><path d="M12 22h14l4 14H8l4-14z"/><path d="M14 28l-1 8M20 28v8M26 28l1 8"/>',
  },
];

export const KLICE_POLOZEK = POLOZKY_TABULE.map((p) => p.klic);

export function nazevPolozky(klic: string): string {
  return POLOZKY_TABULE.find((p) => p.klic === klic)?.nazev ?? klic;
}

/** Co tabule dostane ze serveru. Časy jako ISO text. */
export type DataTabule = {
  studio: { nazev: string; kratce: string; barva: string; casovePasmo: string };
  udalosti: {
    id: string;
    od: string;
    do: string;
    nazev: string;
    druh: string;
    herec: string | null;
    zvukar: string | null;
    mistnost: string | null;
  }[];
  zitra: { od: string; nazev: string; druh: string } | null;
  poznamky: { id: string; text: string; autor: string | null; kdy: string }[];
  chybi: { polozka: string; kdy: string }[];
  ted: string;
  /** Příběhy z Instagramu (22. 9. 2026); null = okno se neukáže. */
  instagram?: {
    ucet: string | null;
    druh: 'pribehy' | 'prispevky';
    polozky: { id: string; typ: 'IMAGE' | 'VIDEO'; url: string; nahled: string | null; kdy: string }[];
  } | null;
};
