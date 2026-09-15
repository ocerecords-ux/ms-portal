/**
 * FORMÁTOVÁNÍ TEXTU ZPRÁVY (zadání 15. 9. 2026: „vlož mi tam ještě nějaké
 * formátování toho textu. Abych mohl dělat text jinou barvou, kurzívou,
 * tučně, velikost písma apod.").
 *
 * PROČ ZNAČKY A NE HTML: vzor píše produkce a ukládá se do databáze. Kdyby
 * se do něj dalo psát HTML, vlezl by do klientského mailu libovolný kód —
 * text se proto pořád escapuje a teprve POTOM se z povolených značek udělá
 * HTML. Povolené je jen to, co je tady; nic jiného se do zprávy nedostane.
 *
 * PROČ TAK MÁLO ZNAČEK: e-mailoví klienti (hlavně Outlook) si s většinou CSS
 * neporadí. Tučné, kurzíva, podtržení, barva a velikost projdou všude; na
 * všechno ostatní je lepší nadpis nebo odstavec.
 *
 * Tenhle soubor je ZÁMĚRNĚ BEZ PRISMY a bez závislostí, aby ho mohl použít
 * i formulář v prohlížeči (lišta s tlačítky) — stejné dělení jako
 * u vzoryZprav.ts.
 */

/** Barvy, které se nabízejí v liště. Jsou to barvy naší identity. */
export const BARVY_TEXTU: { klic: string; nazev: string; hex: string }[] = [
  { klic: 'fialova', nazev: 'Fialová', hex: '#6B2AF0' },
  { klic: 'zelena', nazev: 'Zelená', hex: '#149E4B' },
  { klic: 'cervena', nazev: 'Červená', hex: '#C22B2B' },
  { klic: 'seda', nazev: 'Šedá', hex: '#6E6580' },
];

/** Velikosti písma v bodech. Základ zprávy je 15 px. */
export const VELIKOSTI_TEXTU: { nazev: string; px: number }[] = [
  { nazev: 'Menší', px: 13 },
  { nazev: 'Větší', px: 18 },
  { nazev: 'Velké', px: 22 },
];

const MIN_PX = 10;
const MAX_PX = 32;

/** „fialova" i „#6B2AF0" → hex; cokoliv jiného → null (a značka se zahodí). */
function hexBarvy(hodnota: string): string | null {
  const klic = hodnota.trim().toLowerCase();
  const znama = BARVY_TEXTU.find((b) => b.klic === klic);
  if (znama) return znama.hex;
  return /^#[0-9a-f]{6}$/i.test(klic) ? klic : null;
}

/**
 * Značky → HTML. Vstup MUSÍ být už escapovaný text: funkce jen doplňuje
 * povolené obaly, sama nic neescapuje.
 *
 * Pořadí je důležité: nejdřív párové závorky (můžou obsahovat tučné), pak
 * tučné (dvě hvězdičky) a teprve nakonec kurzíva (jedna hvězdička), aby si
 * kurzíva neukously polovinu tučného.
 */
export function znackyNaHtml(escapovanyText: string): string {
  let t = escapovanyText;

  t = t.replace(/\[barva=([^\]\s]{1,20})\]([\s\S]*?)\[\/barva\]/gi, (_cele, barva: string, obsah: string) => {
    const hex = hexBarvy(barva);
    return hex ? `<span style="color:${hex};">${obsah}</span>` : obsah;
  });

  t = t.replace(/\[velikost=(\d{1,3})\]([\s\S]*?)\[\/velikost\]/gi, (_cele, cislo: string, obsah: string) => {
    const px = Math.min(MAX_PX, Math.max(MIN_PX, Number(cislo)));
    return `<span style="font-size:${px}px;line-height:1.5;">${obsah}</span>`;
  });

  t = t.replace(/\*\*([\s\S]+?)\*\*/g, '<strong>$1</strong>');
  // Kurziva: jedna hvezdicka, ktera nesousedi s dalsi (ta uz je z tucneho
  // pryc) a neni prilepena k mezere - jinak by se chytalo nasobeni „3 * 4".
  // Zamerne bez lookbehind: regulárni vyraz jde i do prohlizece (lista
  // s tlacitky) a starsi Safari by na nem spadlo uz pri nacteni.
  t = t.replace(/(^|[^*\w])\*([^*\n\s](?:[^*\n]*[^*\n\s])?)\*(?!\*)/g, '$1<em>$2</em>');
  t = t.replace(/__([\s\S]+?)__/g, '<span style="text-decoration:underline;">$1</span>');

  return t;
}

/**
 * Značky pryč — pro prostou textovou verzi mailu a pro řádek náhledu
 * v seznamu pošty. Obsah zůstává, obal mizí.
 */
export function bezZnacek(text: string): string {
  return text
    .replace(/\[barva=[^\]\s]{1,20}\]([\s\S]*?)\[\/barva\]/gi, '$1')
    .replace(/\[velikost=\d{1,3}\]([\s\S]*?)\[\/velikost\]/gi, '$1')
    .replace(/\*\*([\s\S]+?)\*\*/g, '$1')
    .replace(/(^|[^*\w])\*([^*\n\s](?:[^*\n]*[^*\n\s])?)\*(?!\*)/g, '$1$2')
    .replace(/__([\s\S]+?)__/g, '$1');
}
