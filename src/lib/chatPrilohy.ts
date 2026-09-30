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

/**
 * Zvuk se v chatu přehrává rovnou, s waveformou jako v Nahrávkách (zadání
 * 9. 9. 2026). Pozor: přehrávání hotového souboru je něco úplně jiného než
 * nahrávání hlasu v chatu - to tu nebude, viz poznámka nahoře.
 */
export function jeZvuk(mime: string): boolean {
  return mime.startsWith('audio/');
}

/** "1,4 MB" - velikost do karty přílohy. */
export function formatVelikost(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} kB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}

/**
 * CO SMÍ POSLAT KLIENT (zadání 30. 9. 2026: „potřebuju, ať klienti můžou
 * vložit pdf do chatu").
 *
 * V týmovém chatu jde poslat cokoliv - je to naše schránka. Do dotazů píše
 * člověk zvenčí, takže se drží úzký seznam: PDF (kvůli tomu to celé je -
 * scénáře, korektury, objednávky) a obrázky, protože fotka nebo snímek
 * obrazovky je druhá věc, kterou klient posílá nejčastěji.
 *
 * Nejde o antivirus - soubor se nikde nespouští a vydává se jen podepsaným
 * odkazem. Jde o to, aby si dotazy nezačaly žít vlastním životem jako
 * úložiště na cokoliv.
 */
const PRIPONY_KLIENTA = ['.pdf', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.heic', '.heif'];

export function smiKlientPriloha(mime: string | null | undefined, nazev: string): boolean {
  const m = (mime ?? '').toLowerCase();
  if (m === 'application/pdf') return true;
  if (m.startsWith('image/')) return true;
  /**
   * Prohlížeč typ někdy nepošle (nebo pošle application/octet-stream) -
   * u .pdf z telefonu se to stává běžně. Přípona je pak jediné, co máme.
   */
  const n = nazev.toLowerCase();
  return PRIPONY_KLIENTA.some((p) => n.endsWith(p));
}

/** Přílohy v dotazech jsou menší - je to příloha k dotazu, ne archiv. */
export const MAX_PRILOHA_KLIENTA_BYTES = 15 * 1024 * 1024;

/** PDF se v bublině ukáže jako karta s ikonou, ne jako obrázek. */
export function jePdf(mime: string, nazev: string): boolean {
  return mime.toLowerCase() === 'application/pdf' || nazev.toLowerCase().endsWith('.pdf');
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
