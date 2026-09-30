import { describe, expect, it } from 'vitest';
import { coSeStane, vyjmenuj, type NahledDotoceni } from '../src/lib/dotoceni';

/**
 * Pojistka před „dotočeno" (zadání 30. 9. 2026: „dal bych tam pojistku, aby
 * když kliknu na dotočeno s hercem, aby se to ještě zeptalo a ukázalo, co se
 * stane — na koho jde notifikace").
 *
 * Podstatné je, že se v potvrzení nikdy nezamlčí, komu odejde zpráva -
 * a hlavně to, jestli ji uvidí KLIENT.
 */
const ZAKLAD: NahledDotoceni = {
  jmenoHerce: 'Martina Černá',
  jeReklama: false,
  uzMa: false,
  stav: null,
  zbyvaHercu: 0,
  nasi: ['Helena Rychlík'],
  klient: null,
  klientDuvod: 'bez-klienta',
};

describe('coSeStane', () => {
  it('řekne fajfku, příjemce i to, že klientovi nic nejde', () => {
    const vety = coSeStane(ZAKLAD);
    expect(vety[0]).toContain('Martina Černá');
    expect(vety.some((v) => v.includes('Helena Rychlík'))).toBe(true);
    expect(vety.some((v) => v.includes('žádného nemá vyplněného'))).toBe(true);
  });

  it('klienta jmenuje, když mu zpráva odejde', () => {
    const vety = coSeStane({ ...ZAKLAD, klient: 'Eva Loskotová', klientDuvod: null });
    expect(vety.some((v) => v.includes('KLIENTOVI Eva Loskotová'))).toBe(true);
  });

  it('rozliší, že klient zprávy vypnul', () => {
    const vety = coSeStane({ ...ZAKLAD, klientDuvod: 'nema-zapnuto' });
    expect(vety.some((v) => v.includes('nezapnul'))).toBe(true);
  });

  it('řekne, na co se přehodí stav projektu', () => {
    const vety = coSeStane({ ...ZAKLAD, stav: { z: 'Natáčíme', na: 'Dotočeno' } });
    expect(vety.some((v) => v.includes('z „Natáčíme“ na „Dotočeno“'))).toBe(true);
  });

  it('u víc herců řekne, že se stav ještě nemění', () => {
    const jeden = coSeStane({ ...ZAKLAD, zbyvaHercu: 1 });
    expect(jeden.some((v) => v.includes('ještě jednomu herci'))).toBe(true);
    const vic = coSeStane({ ...ZAKLAD, zbyvaHercu: 3 });
    expect(vic.some((v) => v.includes('ještě 3 hercům'))).toBe(true);
  });

  it('upozorní, když mail nedostane nikdo z nás', () => {
    const vety = coSeStane({ ...ZAKLAD, nasi: [] });
    expect(vety.some((v) => v.includes('nedostane nikdo'))).toBe(true);
  });

  it('u reklamy se nestane nic', () => {
    expect(coSeStane({ ...ZAKLAD, jeReklama: true })).toEqual([]);
  });
});

describe('vyjmenuj', () => {
  it('spojí jména do věty', () => {
    expect(vyjmenuj([])).toBe('');
    expect(vyjmenuj(['Anna'])).toBe('Anna');
    expect(vyjmenuj(['Anna', 'Petr'])).toBe('Anna a Petr');
    expect(vyjmenuj(['Anna', 'Petr', 'Karel'])).toBe('Anna, Petr a Karel');
  });
});
