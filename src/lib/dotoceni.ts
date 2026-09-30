/**
 * CO SE STANE, KDYŽ SE HERCI OZNAČÍ DOTOČENO (zadání 30. 9. 2026: „dal bych
 * tam pojistku, aby když kliknu na dotočeno s hercem, aby se to ještě zeptalo
 * a ukázalo, co se stane — na koho jde notifikace").
 *
 * Tenhle soubor je BEZ PRISMY, aby ho vzal i prohlížeč: náhled počítá server
 * (lib/dotoceniServer.ts), věty z něj skládá tohle a potvrzovací okno je jen
 * vypíše. Skládání vět je tím pádem na jednom místě a dá se otestovat.
 *
 * JAZYK JE NEPOVINNÝ (dávka 7b): bez něj věty zůstanou české, takže volající
 * na serveru (mail, notifikace) mluví dál česky. Názvy stavů projektu jsou
 * data z databáze a zůstávají české i v anglické větě - viz pravidlo 4
 * a dávka 5 v docs/preklad-portalu.md.
 */
import { prelozit, prelozitS, type Jazyk } from './jazyk';

export type NahledDotoceni = {
  jmenoHerce: string;
  /** U reklamy se nestane nic: ani stav, ani zpráva. */
  jeReklama: boolean;
  /** Herec fajfku už má - kliknutí by nic nezměnilo. */
  uzMa: boolean;
  /** Přehození stavu projektu, když na něj dojde. */
  stav: { z: string; na: string } | null;
  /** Kolik herců projektu ještě fajfku nemá (po tomhle kliknutí). */
  zbyvaHercu: number;
  /** Komu z nás odejde mail. */
  nasi: string[];
  /** Klient projektu, kterému zpráva odejde. `null` = neodejde nikomu. */
  klient: string | null;
  klientDuvod: 'bez-klienta' | 'nema-zapnuto' | null;
};

/** „Anna, Petr a Karel" - do věty, ne jako seznam pod sebou. */
export function vyjmenuj(jmena: string[], jazyk: Jazyk = 'cs'): string {
  if (jmena.length === 0) return '';
  if (jmena.length === 1) return jmena[0];
  const spojka = prelozit(jazyk, 'obecne.spojkaA');
  return `${jmena.slice(0, -1).join(', ')} ${spojka} ${jmena[jmena.length - 1]}`;
}

/**
 * Věty do potvrzení - v pořadí, v jakém se to stane. Prázdné pole znamená,
 * že se nestane nic; i to je odpověď a okno ji řekne nahlas.
 */
export function coSeStane(nahled: NahledDotoceni, jazyk: Jazyk = 'cs'): string[] {
  if (nahled.jeReklama) return [];

  const vety: string[] = [];
  vety.push(prelozitS(jazyk, 'dotoceni.fajfka', { jmeno: nahled.jmenoHerce }));

  if (nahled.stav) {
    vety.push(prelozitS(jazyk, 'dotoceni.stavPrehodi', { z: nahled.stav.z, na: nahled.stav.na }));
  } else if (nahled.zbyvaHercu > 0) {
    vety.push(
      nahled.zbyvaHercu === 1
        ? prelozit(jazyk, 'dotoceni.stavZustavaJeden')
        : prelozitS(jazyk, 'dotoceni.stavZustavaVic', { pocet: nahled.zbyvaHercu }),
    );
  }

  if (nahled.nasi.length > 0) {
    vety.push(prelozitS(jazyk, 'dotoceni.mailDostane', { kdo: vyjmenuj(nahled.nasi, jazyk) }));
  } else {
    vety.push(prelozit(jazyk, 'dotoceni.mailNikdo'));
  }

  if (nahled.klient) {
    vety.push(prelozitS(jazyk, 'dotoceni.klientoviOdejde', { kdo: nahled.klient }));
  } else if (nahled.klientDuvod === 'nema-zapnuto') {
    vety.push(prelozit(jazyk, 'dotoceni.klientNezapnul'));
  } else {
    vety.push(prelozit(jazyk, 'dotoceni.klientNeni'));
  }

  return vety;
}
