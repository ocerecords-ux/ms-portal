/**
 * HUDBA DO PŘÍBĚHŮ - SPOLEČNÁ ČÁST (zadání 8. 10. 2026: „můžeme nějak u toho
 * příběhu rovnou vybrat hudbu jak na instagramu a mít možnost vypnout
 * původní zvuk?").
 *
 * PROČ VLASTNÍ KNIHOVNA, A NE TA INSTAGRAMOVÁ. Kontejner příběhu v Graph API
 * bere jen `image_url` nebo `video_url` a zmínky - žádný parametr pro
 * hudební nálepku ani pro ztlumení zvuku neexistuje. Licence Instagramu
 * navíc platí jen uvnitř jejich aplikace, takže vypálit jejich skladbu do
 * videa by stejně byl problém. Hraje proto jen to, co si do portálu
 * nahrajeme sami - u nahrávacího studia je to spíš výhoda.
 *
 * Soubor je BEZ PRISMY - potřebuje ho i editor v prohlížeči, který podle něj
 * kontroluje typ a velikost ještě před nahráním.
 */

/**
 * Co vezmeme jako skladbu. Rozhoduje, co umí `decodeAudioData` v prohlížeči -
 * MP3, AAC/M4A a WAV umí všechny, OGG na iPhonu ne, proto tu není.
 */
export const TYPY_HUDBY = [
  'audio/mpeg',
  'audio/mp3',
  'audio/mp4',
  'audio/x-m4a',
  'audio/aac',
  'audio/wav',
  'audio/x-wav',
];

/** Co nabídnout ve výběru souboru. */
export const PRIJIMANE_PRIPONY_HUDBY = `${TYPY_HUDBY.join(',')},.mp3,.m4a,.aac,.wav`;

/** Strop velikosti skladby. Celá písnička v MP3 má jednotky MB. */
export const MAX_HUDBA_BYTES = 20 * 1024 * 1024;

/**
 * Jak dlouhý smí být příběh s hudbou. Instagram u příběhu rozseká delší
 * video na díly, což u jedné skladby nedává smysl - a patnáct vteřin je
 * zároveň to, co se vejde do jednoho příběhu.
 */
export const DELKA_PRIBEHU_S = 15;

/** Nabízené délky, aby šel udělat i kratší příběh. */
export const DELKY_PRIBEHU_S = [5, 10, 15];

export function jeHudba(typSouboru: string): boolean {
  return typSouboru.startsWith('audio/');
}

/** Prohlížeč u .m4a občas typ nepozná - doplníme ho z přípony. */
export function typHudby(soubor: File): string {
  if (soubor.type && TYPY_HUDBY.includes(soubor.type)) return soubor.type;
  const pripona = soubor.name.toLowerCase().split('.').pop() ?? '';
  if (pripona === 'mp3') return 'audio/mpeg';
  if (pripona === 'm4a') return 'audio/mp4';
  if (pripona === 'aac') return 'audio/aac';
  if (pripona === 'wav') return 'audio/wav';
  return soubor.type;
}

/** „3:07" - délka skladby do seznamu. */
export function casMinSek(sekundy: number): string {
  const cele = Math.max(0, Math.round(sekundy));
  const m = Math.floor(cele / 60);
  const s = cele % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export type SkladbaRadek = {
  id: string;
  nazev: string;
  autor: string;
  delka: number;
  aktivni: boolean;
  nahral: string | null;
};
