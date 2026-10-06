/**
 * PŘÍBĚHY NA INSTAGRAM - SPOLEČNÁ ČÁST (zadání 6. 10. 2026: „můžeme dát
 * zvukařům přístup, aby mohli posílat na instagram příběhy, aniž by měli
 * přístup na instagram?").
 *
 * Soubor je BEZ PRISMY - potřebuje ho i formulář v prohlížeči, který podle
 * něj kontroluje typ a velikost souboru ještě před nahráním.
 */

/**
 * Stavy. KONCEPT je rozdělaný příběh jen pro autora, VYVESENO je venku.
 * CEKA zůstává pro ten, který se vyvěsit nepodařilo a čeká na další pokus
 * (od 6. 10. 2026 už ne na schválení - vyvěsit smí kdokoli z týmu).
 * ZAMITNUTO se nově nepoužívá, jen dobíhá u starších řádků.
 */
export const STAVY_PRIBEHU = ['KONCEPT', 'CEKA', 'VYVESENO', 'ZAMITNUTO'] as const;
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

/** Jak dlouho je příběh na Instagramu vidět. */
export const PLATNOST_HODIN = 24;

/** Kdy příběh vyprchá - 24 hodin od vyvěšení. */
export function vyprsiV(vyveseno: string | Date): Date {
  const kdy = typeof vyveseno === 'string' ? new Date(vyveseno) : vyveseno;
  return new Date(kdy.getTime() + PLATNOST_HODIN * 3600_000);
}

/**
 * Kolik zbývá, hrubě: „7 h" nebo „24 min". Vrací null, když už je po.
 * Záměrně bez sekund - přebíhající číslo na stránce nikdo nepotřebuje.
 */
export function zbyvaMinut(vyveseno: string | Date, ted = new Date()): number | null {
  const konec = vyprsiV(vyveseno).getTime();
  const zbyva = Math.round((konec - ted.getTime()) / 60_000);
  return zbyva > 0 ? zbyva : null;
}

/** Zminky @neco z textu - v pořadí, bez duplicit. */
export function zminkyZTextu(text: string): string[] {
  const nalezene = text.match(/@[A-Za-z0-9._]{2,30}/g) ?? [];
  return Array.from(new Set(nalezene.map((z) => z.toLowerCase())));
}
