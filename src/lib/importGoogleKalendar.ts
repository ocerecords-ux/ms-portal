/**
 * PŘEVOD STARÉHO GOOGLE KALENDÁŘE (zadání 20. 9. 2026: „potřebuji teď
 * natáhnout data z Google kalendáře… nejdříve je jméno herce, pak název
 * projektu a pak v závorce zvukař zkratkou (TM je Tomáš Moravec, TI je Tomáš
 * Ilavský, R je Richard Hanula). Když je tam jméno herce, tak je to natáčení
 * a když je tam střih, tak jde o střih").
 *
 * Tenhle soubor jen ČTE text události - bez databáze, dá se otestovat.
 * Zápis dělá seed (prisma/seed.ts → prevezmiGoogleKalendar).
 *
 * Tvary, které umí:
 *   „Jiří Miroslav Valůšek – Vlakař (TI)"        → natáčení, herec, projekt, zvukař
 *   „☎ Šárka Šildová – Poslední naživu (R)"      → totéž + poznámka ☎
 *   „Strih (TI) annie bot"  /  „Strih (TM) -Nástroje pro život" → střih
 */

export const ZVUKARI_ZKRATKY: Record<string, string> = {
  TM: 'Tomáš Moravec',
  TI: 'Tomáš Ilavský',
  R: 'Richard Hanula',
};

export type UdalostZGoogle = {
  druh: 'NATACENI' | 'STRIH';
  herec: string | null;
  projekt: string;
  zvukarZkratka: string | null;
  zvukar: string | null;
  /** Značky z textu (☎), které se nevejdou jinam - jdou do poznámky. */
  znacky: string[];
};

export function rozeberUdalost(text: string): UdalostZGoogle {
  let t = text.trim();
  const znacky: string[] = [];
  // Emoji a symboly na zacatku (☎ apod.) - zachovat do poznamky.
  const symbol = /^([^\p{L}\p{N}(-]+)\s*/u.exec(t);
  if (symbol && symbol[1].trim()) {
    znacky.push(symbol[1].trim());
    t = t.slice(symbol[0].length);
  }

  // Zvukar: posledni zavorka s kratkou zkratkou velkymi pismeny.
  let zvukarZkratka: string | null = null;
  const zavorky = Array.from(t.matchAll(/\(([A-ZÁ-Ž]{1,3})\)/g));
  if (zavorky.length > 0) {
    const posledni = zavorky[zavorky.length - 1];
    zvukarZkratka = posledni[1];
    t = (t.slice(0, posledni.index) + t.slice((posledni.index ?? 0) + posledni[0].length)).replace(/\s{2,}/g, ' ').trim();
  }
  const zvukar = zvukarZkratka ? (ZVUKARI_ZKRATKY[zvukarZkratka] ?? null) : null;

  const strih = /^st[řr]ih\b[\s:–-]*/i.exec(t);
  if (strih) {
    const projekt = t.slice(strih[0].length).replace(/^[\s:–-]+/, '').trim();
    return { druh: 'STRIH', herec: null, projekt: projekt || 'Střih', zvukarZkratka, zvukar, znacky };
  }

  // Herec – Projekt (pomlcka dlouha i kratka s mezerami).
  const deleni = /\s+[–—-]\s+/.exec(t);
  if (deleni) {
    return {
      druh: 'NATACENI',
      herec: t.slice(0, deleni.index).trim(),
      projekt: t.slice(deleni.index + deleni[0].length).trim(),
      zvukarZkratka,
      zvukar,
      znacky,
    };
  }
  return { druh: 'NATACENI', herec: null, projekt: t, zvukarZkratka, zvukar, znacky };
}

/** „2026-09-14" + „09:30" v Praze → UTC. Počítá s letním i zimním časem. */
export function prahaNaUtc(datum: string, cas: string): Date {
  const [y, m, d] = datum.split('-').map(Number);
  const [h, min] = cas.split(':').map(Number);
  const odhad = Date.UTC(y, m - 1, d, h, min);
  // Kolik ukazuji hodiny v Praze v okamziku `odhad` - rozdil je posun pasma.
  const casti = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Prague',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(odhad));
  const v = (typ: string) => Number(casti.find((c) => c.type === typ)?.value);
  const vPraze = Date.UTC(v('year'), v('month') - 1, v('day'), v('hour'), v('minute'));
  return new Date(odhad - (vPraze - odhad));
}

/** Bez diakritiky a malými písmeny - pro párování jmen a projektů. */
export function srovnej(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
