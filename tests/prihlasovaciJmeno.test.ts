import { describe, expect, it } from 'vitest';
import { jeEmail, jeJmenoBezZavinace, jePrihlasovaciJmeno } from '../src/lib/prihlasovaciJmeno';

/**
 * PŘIHLAŠOVACÍ JMÉNO (29. 9. 2026: „všude jinde se dá přihlásit bez @").
 *
 * Hlídá se hlavně to, že se jméno bez zavináče nesplete s adresou: podle
 * `jeEmail` se rozhoduje, jestli má kam odejít pozvánka, a poslat ji „nikam"
 * znamená účet, ke kterému se nikdo nedostane.
 */

describe('jeEmail', () => {
  it('bere běžné adresy', () => {
    expect(jeEmail('ondrej.cerny@mediaspace.cz')).toBe(true);
    expect(jeEmail(' BARA@mediaspace.cz ')).toBe(true);
  });

  it('jméno bez zavináče ani rozbitá adresa adresa není', () => {
    expect(jeEmail('brno2')).toBe(false);
    expect(jeEmail('brno2@')).toBe(false);
    expect(jeEmail('brno2@studio')).toBe(false);
    expect(jeEmail('a b@mediaspace.cz')).toBe(false);
  });
});

describe('jeJmenoBezZavinace', () => {
  it('bere jména tabulí', () => {
    expect(jeJmenoBezZavinace('brno2')).toBe(true);
    expect(jeJmenoBezZavinace('tabule-praha')).toBe(true);
    expect(jeJmenoBezZavinace('Brno2')).toBe(true); // velká písmena se srovnají
  });

  it('nebere mezery, zavináč, diakritiku ani jeden znak', () => {
    expect(jeJmenoBezZavinace('b')).toBe(false);
    expect(jeJmenoBezZavinace('brno 2')).toBe(false);
    expect(jeJmenoBezZavinace('brno@2')).toBe(false);
    expect(jeJmenoBezZavinace('brnoč')).toBe(false);
    expect(jeJmenoBezZavinace('-brno')).toBe(false);
  });
});

describe('jePrihlasovaciJmeno', () => {
  it('pustí obojí', () => {
    expect(jePrihlasovaciJmeno('brno2')).toBe(true);
    expect(jePrihlasovaciJmeno('ondrej.cerny@mediaspace.cz')).toBe(true);
  });

  it('nedovolí rozbitou adresu jen proto, že má zavináč', () => {
    expect(jePrihlasovaciJmeno('brno2@')).toBe(false);
  });
});
