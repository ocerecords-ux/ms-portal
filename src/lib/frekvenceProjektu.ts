/**
 * FREKVENCE PROJEKTU - ČISTÉ FUNKCE (připomínka Helči 15. 10. 2026: „bylo by
 * buď datum první frekvence a nebo úplně nejlépe počet dní do první frekvence.
 * Hodilo by se mi, kdybych si mohla ty projekty seřadit právě od první
 * frekvence").
 *
 * Bez Prismy, ať to může použít i prohlížeč (odznak u názvu projektu).
 */

import { kodJazyka, type Jazyk } from '@/lib/jazyk';

/**
 * V JAKÉ FÁZI NATÁČENÍ PROJEKT JE - podle toho se barví ikona kalendáře
 * u názvu (zjednodušení 29. 10. 2026: „červená, když se teprve bude točit
 * a jedno kolik dní; zelená, když to probíhá; šedá, když je dotočeno").
 *
 * Do té doby se barvilo podle počtu dní do nejbližší frekvence (dnes / do
 * týdne / dál) - tedy podle toho, jak moc to spěchá. Teď se barví podle toho,
 * KDE V ZAKÁZCE JSME, což je informace, která v přehledu vydrží déle než jeden
 * den a nepřebarvuje se sama od sebe každé ráno.
 *
 * Rozhoduje KALENDÁŘ, ne stav projektu: šedá tedy znamená „všechny frekvence
 * jsou odbyté". Když se domluví dotočení a přibude termín, ikona zase
 * zčervená - a to je správně, protože se opravdu bude točit.
 */
export type StavNataceni = 'pred' | 'probiha' | 'hotovo';

/**
 * Počet dní do termínu PO DNECH, ne po hodinách (rozhodnutí 15. 10. 2026).
 *
 * Kdyby se počítalo po hodinách, svítilo by v pátek večer u pondělního rána
 * „za 2 dny" a nikdo by nevěděl, který den to je. Oba časy se proto nejdřív
 * srazí na půlnoc a teprve pak odečtou.
 */
export function dniDo(termin: Date, ted: Date = new Date()): number {
  const a = new Date(termin.getFullYear(), termin.getMonth(), termin.getDate()).getTime();
  const b = new Date(ted.getFullYear(), ted.getMonth(), ted.getDate()).getTime();
  return Math.round((a - b) / 86_400_000);
}

/**
 * Barva ikony. Čte se ze dvou dat, která portál o projektu stejně má:
 * `zacatek` je úplně první frekvence, `prvni` ta nejbližší neodbytá (a když
 * jsou všechny za námi, poslední z nich - viz nactiPrvniFrekvence).
 *
 * POČÍTÁ SE PO DNECH. Frekvence, která byla dnes ráno, pořád znamená, že se
 * dnes točí; „probíhá" tedy nekončí v okamžiku, kdy herec odejde ze studia.
 */
export function stavNataceni(
  zacatek: Date | null,
  prvni: Date | null,
  ted: Date = new Date(),
): StavNataceni | null {
  if (!zacatek || !prvni) return null;
  // Ani první frekvence ještě nebyla - celé natáčení je před námi.
  if (dniDo(zacatek, ted) > 0) return 'pred';
  // Něco už bylo; rozhoduje, jestli ještě něco zbývá.
  return dniDo(prvni, ted) >= 0 ? 'probiha' : 'hotovo';
}

/** „dnes" · „zítra" · „za 3 dny" · „28. 10." - do týdne odpočet, dál datum. */
export function popisTerminu(
  termin: Date,
  t: (klic: string, data?: Record<string, string | number>) => string,
  jazyk: Jazyk = 'cs',
  ted: Date = new Date(),
): string {
  const dni = dniDo(termin, ted);
  if (dni < 0) return datumKratce(termin, jazyk);
  if (dni === 0) return t('frekvence.dnes');
  if (dni === 1) return t('frekvence.zitra');
  // Čeština počítá jinak do čtyř a jinak od pěti: „za 3 dny", ale „za 5 dnů".
  if (dni <= 7) return t(dni <= 4 ? 'frekvence.zaDny' : 'frekvence.zaDnu', { pocet: dni });
  return datumKratce(termin, jazyk);
}

/**
 * „28. 10." / „28/10" - bez roku, v přehledu by jen zabíral. Jazyk je
 * nepovinný a výchozí je čeština (dávka 7n), aby se volající z `api/**`
 * chovali přesně jako dřív - stejný vzor jako `terminUkolu.popisTerminu`.
 */
export function datumKratce(d: Date, jazyk: Jazyk = 'cs'): string {
  return new Intl.DateTimeFormat(kodJazyka(jazyk), { day: 'numeric', month: 'numeric' }).format(d);
}
