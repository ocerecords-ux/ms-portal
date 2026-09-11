import { CO_SE_POSILA, STAVY_S_NOTIFIKACI } from '@/lib/notifikaceFirmy';

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
};

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
];

/** Výchozí předmět - stejný, jaký chodil do 11. 9. 2026. */
export const VYCHOZI_PREDMET = '{projekt} - {stav}';

/**
 * Výchozí znění. Texty jsou přesně ty, které portál posílal doteď
 * (CO_SE_POSILA), aby se změnou vzorů nikomu nic nezměnilo pod rukama.
 * Nadpis je prázdný ze stejného důvodu - do teď zprávy žádný neměly.
 */
export function vychoziVzor(stav: string): Vzor {
  return { predmet: VYCHOZI_PREDMET, nadpis: '', text: CO_SE_POSILA[stav] ?? '' };
}

export function vychoziVzory(): Record<string, Vzor> {
  return Object.fromEntries(STAVY_S_NOTIFIKACI.map((s) => [s, vychoziVzor(s)]));
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
