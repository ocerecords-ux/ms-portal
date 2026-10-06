/**
 * PŘÍBĚHY NA INSTAGRAM - SPOLEČNÁ ČÁST (zadání 6. 10. 2026: „můžeme dát
 * zvukařům přístup, aby mohli posílat na instagram příběhy, aniž by měli
 * přístup na instagram?").
 *
 * Soubor je BEZ PRISMY - potřebuje ho i formulář v prohlížeči, který podle
 * něj kontroluje typ a velikost souboru ještě před nahráním.
 */

/** Stavy fronty. CEKA → VYVESENO nebo ZAMITNUTO; zpátky to nejde. */
export const STAVY_PRIBEHU = ['CEKA', 'VYVESENO', 'ZAMITNUTO'] as const;
export type StavPribehu = (typeof STAVY_PRIBEHU)[number];

export function jeStavPribehu(hodnota: string): hodnota is StavPribehu {
  return (STAVY_PRIBEHU as readonly string[]).includes(hodnota);
}

/**
 * CO INSTAGRAM U PŘÍBĚHU VEZME. Držíme se toho, co projde i při pozdějším
 * vyvěšování přes API: JPEG a PNG u fotek, MP4 a MOV u videa. HEIC z iPhonu
 * záměrně NENÍ - Instagram ho nebere a prohlížeč ho neumí ukázat, takže by
 * zvukař nahrál soubor, který nikdo neuvidí. Telefon umí v nastavení fotit
 * „nejkompatibilnější", a sdílení přes aplikaci převádí na JPEG samo.
 */
export const TYPY_FOTKY = ['image/jpeg', 'image/png', 'image/webp'];
export const TYPY_VIDEA = ['video/mp4', 'video/quicktime'];
export const POVOLENE_TYPY = [...TYPY_FOTKY, ...TYPY_VIDEA];

/** Co nabídnout ve výběru souboru na telefonu. */
export const PRIJIMANE_PRIPONY = POVOLENE_TYPY.join(',');

/** Strop velikosti. Fotka z telefonu má jednotky MB, patnáctisekundové video desítky. */
export const MAX_FOTKA_BYTES = 12 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 120 * 1024 * 1024;

export function jeVideo(typSouboru: string): boolean {
  return typSouboru.startsWith('video/');
}

export function maxProTyp(typSouboru: string): number {
  return jeVideo(typSouboru) ? MAX_VIDEO_BYTES : MAX_FOTKA_BYTES;
}

/** „12,4 MB" - do hlášky o moc velkém souboru. */
export function velikostVMB(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}

/** Delší popisek se do příběhu nevejde ani ručně. */
export const MAX_POPISEK = 2200;
