/**
 * Přílohy v MS chatu (zadání 9. 9. 2026: "a co vkládání fotek nebo jiných
 * příloh"). Bez Prismy a bez Reactu, ať to jde použít i v panelu chatu.
 *
 * POZOR NA JEDNU VĚC, KTERÁ VYPADÁ JAKO ROZPOR
 * Uživatel v tomtéž dechu řekl "rozhodně nikdy nebudeme přidávat možnost
 * hlasových zpráv" a zároveň chtěl povolit i zvukové soubory. Rozpor to není:
 * Mediaspace dělá audio, takže poslat kolegovi mp3 se spotem je běžná pracovní
 * věc. Co se dělat NEMÁ, je nahrávání hlasu přímo v chatu - žádné tlačítko
 * s mikrofonem, žádné držení pro nahrávání. Připojit hotový soubor ano,
 * nahrávat hlas v portálu ne.
 */

/** Kolik smí mít jedna příloha. Nad tím už patří soubor na Disk. */
export const MAX_PRILOHA_BYTES = 25 * 1024 * 1024;

/** Kolik příloh smí viset u jedné zprávy. */
export const MAX_PRILOH = 5;

export type ChatPriloha = {
  id: string;
  /** Původní název souboru, jak ho měl uživatel na disku. */
  name: string;
  mime: string;
  size: number;
};

/** Obrázek se ukáže rovnou v bublině, ostatní jako karta s názvem. */
export function jeObrazek(mime: string): boolean {
  return mime.startsWith('image/');
}

/** "1,4 MB" - velikost do karty přílohy. */
export function formatVelikost(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} kB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}

/**
 * Očištění názvu souboru pro cestu v úložišti. Název od uživatele se nikdy
 * nedává do klíče tak, jak přišel - lomítka a tečky by se daly zneužít
 * k vyskočení z adresáře a diakritika dělá v URL nepořádek.
 *
 * Původní název se ukládá zvlášť do databáze, takže si ho uživatel při
 * stažení dostane zpátky celý.
 */
export function bezpecnyNazev(name: string): string {
  const zaklad = name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  const ocisteny = zaklad.replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-');
  return ocisteny.slice(0, 80) || 'soubor';
}
