/**
 * FIREMNÍ AKCE - čistá část (zadání 25. 11. 2026).
 *
 * Bez Prismy, ať si soubor vezme formulář v prohlížeči i server - stejně jako
 * lib/tracklist.ts nebo lib/fakturaCast.ts.
 */

/**
 * CO KDO PIJE (zadání 25. 11. 2026: „a kdo co pije").
 *
 * Zaškrtávátka, ne volné pole: nákup se musí dát sečíst („osm lidí víno, tři
 * pivo"). Upřesnění typu „radši suché bílé" má vlastní řádek pod tím.
 */
export const DRUHY_PITI = [
  { klic: 'VINO_BILE', nazev: 'Bílé víno' },
  { klic: 'VINO_CERVENE', nazev: 'Červené víno' },
  { klic: 'PROSECCO', nazev: 'Prosecco / sekt' },
  { klic: 'PIVO', nazev: 'Pivo' },
  { klic: 'TVRDY', nazev: 'Tvrdý alkohol' },
  { klic: 'NEALKO', nazev: 'Nealko' },
  { klic: 'KAVA_CAJ', nazev: 'Káva / čaj' },
] as const;

export type DruhPiti = (typeof DRUHY_PITI)[number]['klic'];

export const KLICE_PITI: string[] = DRUHY_PITI.map((d) => d.klic);

export function nazevPiti(klic: string): string {
  return DRUHY_PITI.find((d) => d.klic === klic)?.nazev ?? klic;
}

/** Neznámé klíče zahodí - do databáze se nikdy nedostane nic mimo číselník. */
export function pouzeZnamePiti(klice: string[]): string[] {
  return KLICE_PITI.filter((k) => klice.includes(k));
}

/**
 * Člověk, kterého jde pozvat. Je to tu, a ne v akceServer.ts, aby si typ
 * mohla vzít i obrazovka v prohlížeči - ta nesmí sáhnout na soubor s Prismou.
 */
export type Kandidat = {
  id: string;
  jmeno: string;
  email: string;
  skupina: 'TYM' | 'HERCI' | 'KLIENTI';
  firma: string | null;
};

export type OdpovedNaPozvanku = {
  dorazi: boolean | null;
  ubytovani: boolean | null;
  piti: string[];
  pitiText: string | null;
  poznamka: string | null;
};

export type PozvankaPrehled = OdpovedNaPozvanku & {
  id: string;
  jmeno: string;
  email: string;
  odeslanoAt: string | null;
  odpovedelAt: string | null;
};

/**
 * Souhrn pro pořadatele: kolik lidí, kolik postelí a čeho kolik nakoupit.
 * Počítá se z odpovědí, ne z odhadů - kdo neodpověděl, nikam nespadne.
 */
export function souhrnAkce(pozvanky: PozvankaPrehled[]) {
  const odpovedeli = pozvanky.filter((p) => p.odpovedelAt);
  const dorazi = pozvanky.filter((p) => p.dorazi === true);
  const piti = new Map<string, number>();
  for (const p of dorazi) {
    for (const k of p.piti) piti.set(k, (piti.get(k) ?? 0) + 1);
  }
  return {
    pozvano: pozvanky.length,
    odeslano: pozvanky.filter((p) => p.odeslanoAt).length,
    odpovedelo: odpovedeli.length,
    dorazi: dorazi.length,
    nedorazi: pozvanky.filter((p) => p.dorazi === false).length,
    /** Jen z těch, kdo dorazí - postel pro nepřítomného nikdo nechystá. */
    ubytovani: dorazi.filter((p) => p.ubytovani === true).length,
    piti: DRUHY_PITI.map((d) => ({ ...d, pocet: piti.get(d.klic) ?? 0 })).filter((d) => d.pocet > 0),
  };
}
