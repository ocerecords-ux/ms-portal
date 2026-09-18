import {
  CO_SE_POSILA,
  CO_SE_POSILA_REKLAMA,
  stavySNotifikaci,
  type DruhNotifikace,
} from '@/lib/notifikaceFirmy';

/**
 * Vzory zpráv klientovi (zadání 11. 9. 2026: „udělejme vzory a já si je pak
 * můžu textově ještě třeba upravit, pracoval bych i s proměnnými").
 *
 * Texty byly do té doby napsané v kódu. Změnit znění zprávy klientovi kvůli
 * překlepu znamenalo nasazovat portál znovu — a psát to má stejně produkce,
 * ne programátor.
 *
 * Tenhle soubor je ZÁMĚRNĚ BEZ PRISMY: používá ho i formulář v prohlížeči,
 * aby uměl napovědět proměnné a ukázat výchozí znění. Čtení z databáze je
 * v lib/vzoryZpravServer.ts.
 */

export type Vzor = {
  /** Prázdné = použije se výchozí. */
  predmet: string;
  /** Prázdné = zpráva nemá velký nadpis (tak to bylo do 11. 9. 2026). */
  nadpis: string;
  text: string;
  /**
   * Přidat do zprávy tlačítko „Přeposlechnout v AudioTaggeru"? (zadání
   * 14. 9. 2026: „může se někdy stát, že všechny tracky posíláme najednou").
   *
   * Do té doby se to odvozovalo ze stavu - AudioTagger chodil jen se zprávou
   * o prvních tracích. Jenže když se odevzdává všechno naráz, je přeposlech
   * potřeba právě u „Dokončeno - ke schválení". Rozhoduje tedy vzor, ne kód.
   */
  audiotagger: boolean;
};

/** Stavy, u kterých AudioTagger chodil, než se z toho stalo zaškrtávátko. */
const AUDIOTAGGER_VYCHOZI = new Set(['Natáčíme/stříháme', 'Dotočeno/stříháme']);

/**
 * Proměnné, které se ve vzoru dají použít. Do zprávy se dosadí těsně před
 * odesláním — vzor si tedy pamatuje „{projekt}", ne konkrétní název.
 *
 * Schválně jich není víc: nabízet proměnnou, kterou portál v tu chvíli
 * neumí vyplnit, je horší než ji nemít. Do zprávy se pak dostane prázdno
 * a nikdo si toho nevšimne.
 */
export const PROMENNE: { klic: string; popis: string; ukazka: string }[] = [
  { klic: 'projekt', popis: 'Název projektu', ukazka: 'ANNIE BOT' },
  { klic: 'firma', popis: 'Název firmy klienta', ukazka: 'AUDIOTÉKA.CZ s.r.o.' },
  { klic: 'klient', popis: 'Jméno člověka, kterému zpráva jde (oslovení)', ukazka: 'Radka' },
  { klic: 'stav', popis: 'Stav projektu', ukazka: 'Natáčíme/stříháme' },
  /**
   * Celý první řádek zprávy včetně 5. pádu (zadání 15. 9. 2026). Dřív ho
   * portál psal sám a nešel přepsat; teď je to obyčejná proměnná, takže se
   * dá přesunout, přeformulovat i úplně vynechat.
   */
  { klic: 'osloveni', popis: 'Oslovení („Dobrý den, Radko,")', ukazka: 'Dobrý den, Radko,' },
];

/** Výchozí předmět - stejný, jaký chodil do 11. 9. 2026. */
export const VYCHOZI_PREDMET = '{projekt} - {stav}';

/**
 * Předmět u reklamy (zadání 14. 9. 2026). Stav v předmětu by klientovi
 * z agentury nic neřekl - zajímá ho, že je co schvalovat.
 */
export const VYCHOZI_PREDMET_REKLAMA = '{projekt} - ke schválení';

/** Nadpis nad textem u reklamy - audioknihy ho nemají, tady dává smysl. */
export const VYCHOZI_NADPIS_REKLAMA = 'Nahrávka je hotová';

/**
 * Výchozí znění. Texty jsou přesně ty, které portál posílal doteď
 * (CO_SE_POSILA), aby se změnou vzorů nikomu nic nezměnilo pod rukama.
 * Nadpis je prázdný ze stejného důvodu - do teď zprávy žádný neměly.
 */
export function vychoziVzor(stav: string, druh: DruhNotifikace = 'AUDIOKNIHA'): Vzor {
  if (druh === 'REKLAMA') {
    return {
      predmet: VYCHOZI_PREDMET_REKLAMA,
      nadpis: VYCHOZI_NADPIS_REKLAMA,
      text: CO_SE_POSILA_REKLAMA[stav] ?? '',
      // U reklamy se nepřeposlouchává po stopách - spot je jeden kus.
      audiotagger: false,
    };
  }
  return {
    predmet: VYCHOZI_PREDMET,
    nadpis: '',
    text: CO_SE_POSILA[stav] ?? '',
    audiotagger: AUDIOTAGGER_VYCHOZI.has(stav),
  };
}

export function vychoziVzory(druh: DruhNotifikace = 'AUDIOKNIHA'): Record<string, Vzor> {
  return Object.fromEntries(stavySNotifikaci(druh).map((s) => [s, vychoziVzor(s, druh)]));
}

/**
 * Dosadí proměnné. Nezná-li klíč, nechá ho být — je to lepší než ho tiše
 * smazat: v odeslané zprávě je pak vidět „{herec}" a je jasné, co opravit.
 * Prázdná hodnota se ale dosadí jako prázdno (projekt bez firmy).
 */
export function dosadPromenne(text: string, hodnoty: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (cele, klic: string) =>
    Object.prototype.hasOwnProperty.call(hodnoty, klic) ? hodnoty[klic] : cele,
  );
}

/** Ukázkové hodnoty pro náhled ve formuláři. */
export function ukazkoveHodnoty(stav: string): Record<string, string> {
  const h = Object.fromEntries(PROMENNE.map((p) => [p.klic, p.ukazka]));
  return { ...h, stav };
}
