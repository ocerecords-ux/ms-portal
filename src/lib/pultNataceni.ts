/**
 * NAŠE NATÁČECÍ PROSTŘEDÍ – „PULT" (zadání 11. 10. 2026: „nešlo by ještě
 * obrndovat nějak to prostředí pro natáčení? Abychom měli otevřený přímo
 * na levo text z výstupů a v pravo okna účastníků?").
 *
 * PROČ VLASTNÍ, A NE GOOGLE MEET V RÁMCI: Meet se do cizí stránky vložit
 * nedá - Google to zakazuje hlavičkou prohlížeče a žádné oficiální vkládání
 * nenabízí. Jediná cesta k „text vlevo, lidi vpravo" je mít hovor vlastní.
 *
 * BĚŽNÝ PROVOZ ZŮSTÁVÁ NA MEETU (rozhodnutí 11. 10. 2026: „Zatím ale nechme
 * běžný provoz na Google Meet. Překlopíme to, až to bude dávat smysl").
 * Tohle je zkušebna: do pozvánek se odkaz na pult NEPOSÍLÁ, otevírá se
 * jen ručně z karty Hosté na natáčení.
 *
 * CO UMÍ A CO NE:
 * - Obraz a zvuk jdou PŘÍMO mezi prohlížeči (WebRTC), ne přes náš server.
 * - Každý se spojí s každým („mesh"). To unese rozumně 4-5 lidí; výš by
 *   bylo potřeba přeposílací server (SFU), a ten se ručně nepíše.
 * - Zvuk schválně BEZ úprav prohlížeče (viz ZVUK_STUDIO) - právě to Meet
 *   neumí vypnout a kvůli čemu se herec přes Meet nedá poslouchat jako
 *   ve studiu.
 *
 * Tenhle soubor je ČISTÝ (bez databáze), aby šel použít i v prohlížeči.
 */

/** Druhy zpráv signalizace. Víc v modelu PultZprava ve schématu. */
export type DruhZpravy = 'ahoj' | 'odchod' | 'nabidka' | 'odpoved' | 'cesta';

export type ZpravaPultu = {
  id: string;
  odKoho: string;
  komu: string | null;
  druh: DruhZpravy;
  telo: unknown;
  jmeno: string | null;
};

/**
 * ZVUK JAKO VE STUDIU. Prohlížeč normálně zapne potlačení echa, redukci šumu
 * a automatické vyrovnání hlasitosti - pro poradu dobře, pro poslech herce
 * špatně: ruší dynamiku, polyká konce slov a „dýchá". Tohle všechno vypíná.
 *
 * Meet tyhle úpravy vypnout nedovolí - je to hlavní věcný důvod mít hovor
 * vlastní, ne jen jiný rámeček okolo.
 */
export const ZVUK_STUDIO: MediaTrackConstraints = {
  echoCancellation: false,
  noiseSuppression: false,
  autoGainControl: false,
  channelCount: 1,
  sampleRate: 48_000,
};

export const OBRAZ_PULTU: MediaTrackConstraints = {
  width: { ideal: 1280 },
  height: { ideal: 720 },
  frameRate: { ideal: 25 },
};

/**
 * JAK ČASTO SE CHODÍ PRO ZPRÁVY. Schránka v databázi není okamžitá jako
 * WebSocket, ale záleží na tom jen při navazování - jakmile spojení stojí,
 * obraz a zvuk tudy nejdou. Proto se po spojení dotazuje línějí.
 */
export const DOTAZ_SPOJOVANI_MS = 1_000;
export const DOTAZ_USAZENO_MS = 4_000;

/** Po téhle době bez ozvání se účastník z dlaždic odklidí. */
export const TICHO_ODCHOD_MS = 25_000;

/** Starší zprávy nemá smysl doručovat - spojení se mezitím navazuje znovu. */
export const ZPRAVA_PLATNOST_MS = 60_000;

export function nahodneId(): string {
  const a = new Uint8Array(8);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * KDO ZAČÍNÁ. Při spojení dvou prohlížečů musí nabídku poslat právě jeden,
 * jinak si oba skočí do řeči a spojení se nenaváže. Rozhodne porovnání
 * náhodných id - bez další domluvy a oběma stranám vyjde stejně.
 */
export function zacinamJa(moje: string, cizi: string): boolean {
  return moje > cizi;
}
