/**
 * CO SE STANE, KDYŽ SE HERCI OZNAČÍ DOTOČENO (zadání 30. 9. 2026: „dal bych
 * tam pojistku, aby když kliknu na dotočeno s hercem, aby se to ještě zeptalo
 * a ukázalo, co se stane — na koho jde notifikace").
 *
 * Tenhle soubor je BEZ PRISMY, aby ho vzal i prohlížeč: náhled počítá server
 * (lib/dotoceniServer.ts), věty z něj skládá tohle a potvrzovací okno je jen
 * vypíše. Skládání vět je tím pádem na jednom místě a dá se otestovat.
 */

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
export function vyjmenuj(jmena: string[]): string {
  if (jmena.length === 0) return '';
  if (jmena.length === 1) return jmena[0];
  return `${jmena.slice(0, -1).join(', ')} a ${jmena[jmena.length - 1]}`;
}

/**
 * Věty do potvrzení - v pořadí, v jakém se to stane. Prázdné pole znamená,
 * že se nestane nic; i to je odpověď a okno ji řekne nahlas.
 */
export function coSeStane(nahled: NahledDotoceni): string[] {
  if (nahled.jeReklama) return [];

  const vety: string[] = [];
  vety.push(`${nahled.jmenoHerce} dostane fajfku „dotočeno“ s dnešním datem.`);

  if (nahled.stav) {
    vety.push(`Stav projektu se přehodí z „${nahled.stav.z}“ na „${nahled.stav.na}“.`);
  } else if (nahled.zbyvaHercu > 0) {
    vety.push(
      nahled.zbyvaHercu === 1
        ? 'Stav projektu se zatím nemění - dotočeno chybí ještě jednomu herci.'
        : `Stav projektu se zatím nemění - dotočeno chybí ještě ${nahled.zbyvaHercu} hercům.`,
    );
  }

  if (nahled.nasi.length > 0) {
    vety.push(`Mail o tom dostane ${vyjmenuj(nahled.nasi)}.`);
  } else {
    vety.push('Z nás to mailem nedostane nikdo - nemá to nikdo zaškrtnuté na kartě účtu.');
  }

  if (nahled.klient) {
    vety.push(`KLIENTOVI ${nahled.klient} odejde zpráva, že je s hercem dotočeno.`);
  } else if (nahled.klientDuvod === 'nema-zapnuto') {
    vety.push('Klientovi nic nechodí - zprávy o dotočení si nezapnul.');
  } else {
    vety.push('Klientovi nic nechodí - projekt žádného nemá vyplněného.');
  }

  return vety;
}
