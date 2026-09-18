/**
 * MARKERY DO CUBASE (zadání 18. 9. 2026: „potřebuju, abychom si v kartě
 * přeposlech mohli stáhnout jedny markery hromadně, abychom si je nasadili do
 * projektu v Cubase").
 *
 * PROČ MIDI, A NE CSV. Cubase umí markery do projektu dostat jedinou
 * spolehlivou cestou: ze standardního MIDI souboru, kde jsou zapsané jako
 * „marker meta events" (Soubor ▸ Předvolby ▸ MIDI ▸ MIDI soubor ▸ Importovat
 * markery, pak se MIDI soubor prostě importuje). CSV umí Cubase jen
 * vyexportovat, ne načíst - tabulka ke stažení proto v přeposlechu zůstává
 * jako záloha pro lidi, ne jako cesta do Cubase.
 *
 * ČAS NA OSE je tentýž, se kterým počítá celý přeposlech: stopa 01 začíná
 * v nule, každá další o hodinu dál (viz DELKA_STOPY_V_CUBASE). Markery tedy
 * padnou přesně tam, kde je tým slyšel.
 *
 * TEMPO. MIDI zná jen doby, ne vteřiny - proto se do souboru zapisuje tempo
 * 120 BPM a při něm jedna vteřina odpovídá 960 tikům. Když má projekt
 * v Cubase jiné tempo, markery sednou na stejné DOBY, ne na stejné vteřiny;
 * pak stačí importovat i tempo, nebo mít projekt na 120.
 *
 * Soubor je bez Prismy i bez knihoven - MIDI je pár bajtů a kvůli tomu se
 * nebude do portálu tahat balík.
 */

export type MarkerDoCubase = {
  /** Vteřiny od začátku projektu v Cubase. */
  cas: number;
  nazev: string;
};

/** Doby na čtvrťovou notu. 480 je běžný standard, Cubase s ním počítá taky. */
const PPQ = 480;
const TEMPO_BPM = 120;

/** Kolik tiků je jedna vteřina při zapsaném tempu. */
export const TIKU_ZA_VTERINU = (PPQ * TEMPO_BPM) / 60;

/**
 * Diakritika pryč. Meta text v MIDI je posloupnost bajtů bez určeného
 * kódování - Cubase i většina DAW ho čte jako jednobajtový text, takže „ř"
 * by se v markeru ukázalo jako dva nesmysly. Radši „prerek" než „pÅ™eÅ™ek".
 */
export function bezDiakritiky(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\x20-\x7E]/g, '')
    .trim();
}

/** Číslo jako proměnná délka (variable-length quantity), jak to chce MIDI. */
function promennaDelka(hodnota: number): number[] {
  let n = Math.max(0, Math.round(hodnota));
  const bajty = [n & 0x7f];
  n = Math.floor(n / 128);
  while (n > 0) {
    bajty.unshift((n & 0x7f) | 0x80);
    n = Math.floor(n / 128);
  }
  return bajty;
}

function ctyriBajty(hodnota: number): number[] {
  return [(hodnota >> 24) & 0xff, (hodnota >> 16) & 0xff, (hodnota >> 8) & 0xff, hodnota & 0xff];
}

function znaky(text: string): number[] {
  return Array.from(text).map((z) => z.charCodeAt(0) & 0xff);
}

/**
 * Standardní MIDI soubor (formát 0) s jedinou stopou, ve které jsou jen
 * tempo a markery. Vrací hotové bajty k uložení jako .mid.
 */
export function souborMarkeru(markery: MarkerDoCubase[]): Uint8Array {
  const serazene = [...markery]
    .map((m) => ({ tik: Math.max(0, Math.round(m.cas * TIKU_ZA_VTERINU)), nazev: bezDiakritiky(m.nazev) }))
    .filter((m) => m.nazev.length > 0)
    .sort((a, b) => a.tik - b.tik);

  const udalosti: number[] = [];

  // Tempo hned na zacatku: FF 51 03 <mikrosekundy na ctvrtku>.
  const mikrosekundy = Math.round(60_000_000 / TEMPO_BPM);
  udalosti.push(
    ...promennaDelka(0),
    0xff,
    0x51,
    0x03,
    (mikrosekundy >> 16) & 0xff,
    (mikrosekundy >> 8) & 0xff,
    mikrosekundy & 0xff,
  );

  let posledni = 0;
  for (const m of serazene) {
    const text = znaky(m.nazev.slice(0, 120));
    udalosti.push(...promennaDelka(m.tik - posledni), 0xff, 0x06, ...promennaDelka(text.length), ...text);
    posledni = m.tik;
  }

  // Konec stopy: FF 2F 00.
  udalosti.push(...promennaDelka(0), 0xff, 0x2f, 0x00);

  const hlavicka = [
    0x4d, 0x54, 0x68, 0x64, // "MThd"
    0, 0, 0, 6, // delka hlavicky
    0, 0, // format 0
    0, 1, // jedna stopa
    (PPQ >> 8) & 0xff,
    PPQ & 0xff,
  ];
  const stopa = [
    0x4d, 0x54, 0x72, 0x6b, // "MTrk"
    ...ctyriBajty(udalosti.length),
    ...udalosti,
  ];

  return Uint8Array.from([...hlavicka, ...stopa]);
}

/** Kolik markerů v souboru doopravdy bude (prázdné názvy se vynechají). */
export function pocetMarkeru(markery: MarkerDoCubase[]): number {
  return markery.filter((m) => bezDiakritiky(m.nazev).length > 0).length;
}
