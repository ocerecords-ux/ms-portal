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
    kdy: 'Šestého v měsíci, za měsíc minulý.',
    komu: 'Každému zvukaři, který v tom měsíci něco vykázal.',
    nahled: '/api/admin/vykazy/nahled-mesicni',
  },
];

export const KLICE_OZNAMENI: KlicOznameni[] = OZNAMENI.map((o) => o.klic);
