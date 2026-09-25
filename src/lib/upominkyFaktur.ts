/**
 * UPOMÍNKY K FAKTURÁM PO SPLATNOSTI (zadání 25. 9. 2026: „potřebuji nastavit
 * upomínky na faktury po splatnosti. Chci je někde editovat, včetně náhledu
 * emailu").
 *
 * Tenhle soubor nesahá do databáze - používá ho i formulář v prohlížeči, aby
 * uměl napovědět proměnné a ukázat výchozí znění. Čtení a odesílání je
 * v lib/upominkyServer.ts.
 *
 * ZNĚNÍ JE JEDNO PRO VŠECHNY UPOMÍNKY, mění se jen den odeslání. Tři různé
 * texty (zdvořilý, důraznější, poslední) zněly jako dobrý nápad, ale znamenaly
 * by tři pole k údržbě a upomínka se stejně píše jedním tónem; kdo chce
 * přitvrdit, napíše si to sám. Pořadí upomínky je proměnná, takže se do textu
 * dá dostat i tak.
 */

/** Po kolika dnech po splatnosti chodí první, druhá a třetí upomínka. */
export const VYCHOZI_DNY = [3, 10, 21];

export const VYCHOZI_PREDMET = 'Upomínka: faktura {cislo} po splatnosti';

export const VYCHOZI_TEXT =
  '{osloveni}\n\nevidujeme neuhrazenou fakturu **{cislo}** na částku **{castka}** se splatností **{splatnost}** — je {dnu} po splatnosti.\n\nProsíme o její úhradu. Pokud už platba odešla, považujte tuhle zprávu za bezpředmětnou a dejte nám prosím vědět.';

/** Proměnné, které se dají použít ve znění. */
export const PROMENNE_UPOMINKY: { klic: string; popis: string; ukazka: string }[] = [
  { klic: 'osloveni', popis: 'Oslovení („Dobrý den, Radko,")', ukazka: 'Dobrý den, Radko,' },
  { klic: 'klient', popis: 'Jméno člověka, kterému zpráva jde', ukazka: 'Radka' },
  { klic: 'firma', popis: 'Název firmy klienta', ukazka: 'AUDIOTÉKA.CZ s.r.o.' },
  { klic: 'cislo', popis: 'Číslo faktury', ukazka: '20260142' },
  { klic: 'castka', popis: 'Částka k úhradě včetně DPH', ukazka: '48 400,00 Kč' },
  { klic: 'splatnost', popis: 'Datum splatnosti', ukazka: '12. 9. 2026' },
  { klic: 'dnu', popis: 'Jak dlouho je faktura po splatnosti', ukazka: '13 dní' },
  { klic: 'poradi', popis: 'Kolikátá upomínka to je', ukazka: '2' },
  { klic: 'projekt', popis: 'Název projektu, když je faktura navázaná', ukazka: 'ANNIE BOT' },
];

export type HodnotyUpominky = Record<string, string>;

export function ukazkoveHodnotyUpominky(): HodnotyUpominky {
  return Object.fromEntries(PROMENNE_UPOMINKY.map((p) => [p.klic, p.ukazka]));
}

/** „{cislo}" → skutečná hodnota. Neznámá proměnná zůstane, ať je vidět překlep. */
export function dosadDoUpominky(text: string, hodnoty: HodnotyUpominky): string {
  return text.replace(/\{(\w+)\}/g, (cele, klic: string) => hodnoty[klic] ?? cele);
}

/** „13 dní" / „1 den" / „3 dny" - do věty, ne tabulky. */
export function popisDnu(dnu: number): string {
  if (dnu === 1) return '1 den';
  if (dnu >= 2 && dnu <= 4) return `${dnu} dny`;
  return `${dnu} dní`;
}

/**
 * Kolikátá upomínka má být dnes odeslaná, když je faktura `dnu` po splatnosti
 * a už jich odešlo `uzOdeslano`. Vrací `null`, když se nic posílat nemá.
 *
 * Pravidlo: upomínka číslo N odejde, jakmile je po splatnosti aspoň `dny[N-1]`
 * dní a N-tá ještě neodešla. Zpožděný běh úlohy (nebo faktura zadaná pozdě)
 * tedy nic nepřeskočí - pošle se ta nejnižší, která ještě nešla.
 */
export function kteraUpominka(
  dny: number[],
  dnuPoSplatnosti: number,
  uzOdeslano: number,
): number | null {
  const poradi = uzOdeslano + 1;
  if (poradi > dny.length) return null;
  const prah = dny[poradi - 1];
  if (!Number.isFinite(prah) || dnuPoSplatnosti < prah) return null;
  return poradi;
}
