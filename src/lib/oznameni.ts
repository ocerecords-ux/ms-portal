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

export type KlicOznameni = 'BONUS_SCHVALEN' | 'MESICNI_PREHLED' | 'PREPOSLECH_DIKY';

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
  /**
   * VÝCHOZÍ ZNĚNÍ, KTERÉ JDE PŘEPSAT (zadání 18. 11. 2026). Zpráva, která
   * tohle má, se v administraci nabídne k úpravě; co ho nemá, má jen vypínač,
   * protože jeho mail je tabulka skládaná z dat, ne volný text.
   */
  vychozi?: { predmet: string; nadpis: string; text: string };
  /** Značky, které se v textu nahradí - bez nich by je nikdo neuhodl. */
  znacky?: { znacka: string; popis: string }[];
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
  {
    klic: 'PREPOSLECH_DIKY',
    nazev: 'Poděkování za kontrolní poslech',
    popis: 'Poděkování s celkovým časem nahrávky a s dotazem na podněty k AudioTaggeru.',
    kdy: 'Ve chvíli, kdy přeposlech odklepne někdo zvenčí. Při našem interním odškrtnutí neodchází.',
    komu: 'Jen tomu jedinému člověku, který zmáčkl Přeposlechnuto. Ostatním posluchačům ani klientovi ne.',
    nahled: '/api/admin/preposlech/nahled-diky',
    vychozi: {
      predmet: 'Děkujeme za kontrolní poslech — {projekt}',
      nadpis: 'Děkujeme za kontrolní poslech',
      text: [
        'Dobrý den,',
        '',
        'děkujeme za kontrolní poslech audioknihy **{projekt}**.',
        '',
        'Fungovalo vše bez problémů? Pokud máte nějaké podněty pro zlepšení AudioTaggeru, zanechte nám je prosím zde.',
      ].join('\n'),
    },
    znacky: [
      { znacka: '{projekt}', popis: 'Název projektu.' },
      { znacka: '{jmeno}', popis: 'Jméno toho, kdo přeposlech odklepl.' },
      { znacka: '{celkovycas}', popis: 'Celkový čas nahrávky, například „8 h 42 min 15 s".' },
      { znacka: '{pocetstop}', popis: 'Kolik stop na Disku leží.' },
    ],
  },
];

/**
 * Znění zprávy - uložené, nebo výchozí. Uložené prázdno se bere jako „vrátit
 * výchozí", proto se prázdné řetězce přeskakují.
 */
export function zneniOznameni(
  o: PopisOznameni,
  ulozene?: { predmet?: string | null; nadpis?: string | null; text?: string | null } | null,
): { predmet: string; nadpis: string; text: string } {
  const vychozi = o.vychozi ?? { predmet: '', nadpis: '', text: '' };
  return {
    predmet: ulozene?.predmet?.trim() || vychozi.predmet,
    nadpis: ulozene?.nadpis?.trim() || vychozi.nadpis,
    text: ulozene?.text?.trim() || vychozi.text,
  };
}

/** Dosadí značky do textu. Co ve `hodnoty` není, se nechá být. */
export function dosadZnacky(text: string, hodnoty: Record<string, string>): string {
  return text.replace(/\{([a-z]+)\}/g, (cele, klic: string) =>
    klic in hodnoty ? hodnoty[klic] : cele,
  );
}

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
