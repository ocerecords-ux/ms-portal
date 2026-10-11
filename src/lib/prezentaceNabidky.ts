/**
 * NABÍDKOVÁ PREZENTACE PRO KLIENTA (zadání 11. 10. 2026: „potřebuju udělat
 * takový maker cenových nabídek obrandovaných, které pošlu jedním odkazem
 * na klienta. Musí to být něco wow a srozumitelné").
 *
 * Tenhle soubor je ČISTÝ (bez databáze), aby šel použít i v prohlížeči -
 * stejné názvy sekcí a tytéž pomůcky má builder u projektu i veřejná stránka.
 *
 * CO PREZENTACE OBSAHUJE, v tomhle pořadí (zadání):
 *   1. Název projektu a klient
 *   2. Naše reference - ukázky z minulých projektů k poslechu
 *   3. Návrh řešení
 *   4. Nabídka herců - dema v přehrávači, klient si může jedno vybrat
 *   5. Cenová nabídka - položky z dokladu u projektu
 *   6. Podmínky spolupráce - licence, termíny dodání
 */

/**
 * CO SE DO KNIHOVNY PŘIJÍMÁ. Zvuk i video - u reference je často hotový spot
 * s obrazem, u herce stačí MP3. Přípona se dopočítá, když prohlížeč typ
 * nepošle (stává se u .m4a a u souborů z Finderu).
 */
export const TYPY_UKAZEK = [
  'audio/mpeg',
  'audio/mp3',
  'audio/mp4',
  'audio/x-m4a',
  'audio/aac',
  'audio/wav',
  'video/mp4',
  'video/quicktime',
  'video/webm',
];

export const PRIJIMANE_PRIPONY_UKAZEK = `${TYPY_UKAZEK.join(',')},.mp3,.m4a,.aac,.wav,.mp4,.mov,.webm`;

/**
 * Strop velikosti. Ukázka je výřez, ne celý film - kdo sem chce nahrát
 * stominutové video, má v knihovně něco jiného, než co klient vydrží poslouchat.
 */
export const MAX_UKAZKA_BYTES = 60 * 1024 * 1024;

export function typUkazky(soubor: { type?: string; name: string }): string | null {
  if (soubor.type && TYPY_UKAZEK.includes(soubor.type)) return soubor.type;
  const pripona = soubor.name.toLowerCase().split('.').pop() ?? '';
  const podle: Record<string, string> = {
    mp3: 'audio/mpeg',
    m4a: 'audio/mp4',
    aac: 'audio/aac',
    wav: 'audio/wav',
    mp4: 'video/mp4',
    mov: 'video/quicktime',
    webm: 'video/webm',
  };
  return podle[pripona] ?? null;
}

/** Dvě sekce ukázek. Tatáž nahrávka může sloužit v obou. */
export const SEKCE = { reference: 'REFERENCE', herec: 'HEREC' } as const;
export type Sekce = (typeof SEKCE)[keyof typeof SEKCE];

export type UkazkaData = {
  id: string;
  druh: Sekce;
  nazev: string;
  popis: string | null;
  typSouboru: string;
  delka: number;
  stitky: string;
};

/** Je to video? Pak se nevykresluje přehrávač se zvukovou křivkou, ale obraz. */
export function jeVideo(typSouboru: string): boolean {
  return typSouboru.startsWith('video/');
}

/** „2:45" - délka ukázky k názvu, ať klient ví, do čeho jde. */
export function delkaSlovy(sekundy: number): string {
  if (!Number.isFinite(sekundy) || sekundy <= 0) return '';
  const m = Math.floor(sekundy / 60);
  const s = Math.round(sekundy % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Adresa souboru ukázky. Veřejná - prezentaci otevírá klient bez účtu. */
export function odkazNaUkazku(id: string): string {
  return `/api/ukazky/${encodeURIComponent(id)}/soubor`;
}

/**
 * Štítky z jednoho políčka. Píšou se po čárce, protože vymýšlet správu
 * číselníku kvůli slovu „žena" by bylo víc práce než užitku.
 */
export function rozdelStitky(stitky: string): string[] {
  return stitky
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Hledání v knihovně - bez diakritiky a bez ohledu na velikost písmen. */
export function srovnej(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

export function hledaniSedi(ukazka: UkazkaData, dotaz: string): boolean {
  const hledane = srovnej(dotaz);
  if (!hledane) return true;
  return srovnej(`${ukazka.nazev} ${ukazka.popis ?? ''} ${ukazka.stitky}`).includes(hledane);
}
