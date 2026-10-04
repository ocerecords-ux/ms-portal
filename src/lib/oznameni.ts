/**
 * AUTOMATICKÉ ZPRÁVY PORTÁLU LIDEM Z MEDIASPACE (zadání 15. 9. 2026:
 * „udělejme pro tyhle maily a notifikace pak někde administraci").
 *
 * Tohle NENÍ o zprávách klientovi — ty mají vlastní obrazovku (Vzory zpráv)
 * a nastavují se u každé firmy zvlášť. Tady jsou zprávy, které chodí NÁM:
 * zvukařům o bonusu a o měsíčním přehledu.
 *
 * Soubor je záměrně bez Prismy, aby si ho mohl vzít i formulář v prohlížeči.
 * Čtení a zápis do databáze je v lib/oznameniServer.ts.
 */

import { prelozit, type Jazyk } from '@/lib/jazyk';

export type KlicOznameni = 'BONUS_SCHVALEN' | 'MESICNI_PREHLED';

export type PopisOznameni = {
  klic: KlicOznameni;
  nazev: string;
  /** Jednou větou, co ve zprávě stojí. */
  popis: string;
  /** Kdy odchází. */
  kdy: string;
  /** Komu chodí. */
  komu: string;
  /** Adresa náhledu - ukáže, jak mail vypadá. */
  nahled: string;
};

export const OZNAMENI: PopisOznameni[] = [
  {
    klic: 'BONUS_SCHVALEN',
    nazev: 'Schválený bonus',
    popis: 'Částka, kniha, podíl na střihu (nebo za co bonus je) a kdo ho schválil.',
    kdy: 'Hned po schválení návrhu nebo po ručním přidání bonusu.',
    komu: 'Zvukaři, kterému bonus patří.',
    nahled: '/api/admin/bonusy/nahled',
  },
  {
    klic: 'MESICNI_PREHLED',
    nazev: 'Měsíční přehled výkazů',
    popis: 'Odpracované hodiny a částka, rozpad podle druhu práce, projekty a schválené bonusy.',
    kdy: 'Za měsíc minulý, v den nastavený v Přehledy → Zvukaři (výchozí šestého).',
    komu: 'Každému zvukaři, který v tom měsíci něco vykázal.',
    nahled: '/api/admin/vykazy/nahled-mesicni',
  },
];

export const KLICE_OZNAMENI: KlicOznameni[] = OZNAMENI.map((o) => o.klic);

/**
 * Popisek zprávy podle KÓDU, ne podle českého názvu (vzor `nazevMeny`
 * z dávky 4). Jazyk je NEPOVINNÝ - bez něj zůstává česká strana jako zdroj
 * pravdy, takže si texty výš může vzít i pošta.
 */
export function popisekOznameni(
  o: PopisOznameni,
  cast: 'nazev' | 'popis' | 'kdy' | 'komu',
  jazyk?: Jazyk,
): string {
  if (!jazyk || jazyk === 'cs') return o[cast];
  const klic = `oznameni.${o.klic}.${cast}`;
  const text = prelozit(jazyk, klic);
  return text === klic ? o[cast] : text;
}
