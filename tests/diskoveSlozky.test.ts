import { describe, expect, it } from 'vitest';
import { nabidkaSlozek, type SlozkaKNabidce } from '../src/lib/diskoveSlozky';

/**
 * Složky na Disku (zadání 30. 9. 2026: „máme na disku složky: Klientská zóna,
 * Dokumenty, Marketing. Potřebuju, ať někteří uživatelé nevidí některé
 * složky. Teď vidí všechno").
 *
 * Podstatné je, že se v nabídce nikdy neobjeví složka, kterou člověk nemá -
 * ani zašedlá, ani jménem. Kdo ji nemá, se z portálu nedozví, že existuje.
 */
function slozka(zmeny: Partial<SlozkaKNabidce> = {}): SlozkaKNabidce {
  return {
    id: 'klientska-zona',
    nazev: 'Klientská zóna',
    popis: null,
    rootId: '1AbCdEf',
    aktivni: true,
    prideleno: true,
    ...zmeny,
  };
}

describe('nabidkaSlozek', () => {
  it('nabídne přidělenou složku', () => {
    expect(nabidkaSlozek([slozka()], false)).toEqual([
      { id: 'klientska-zona', nazev: 'Klientská zóna', popis: null, rootId: '1AbCdEf' },
    ]);
  });

  it('nepřidělenou složku zamlčí úplně', () => {
    expect(nabidkaSlozek([slozka({ prideleno: false })], false)).toEqual([]);
  });

  it('vypnutou složku nenabídne ani tomu, kdo ji má', () => {
    expect(nabidkaSlozek([slozka({ aktivni: false })], false)).toEqual([]);
  });

  it('vypnutou složku nenabídne ani superadminovi', () => {
    expect(nabidkaSlozek([slozka({ aktivni: false, prideleno: false })], true)).toEqual([]);
  });

  it('superadmin vidí i to, co nemá zaškrtnuté', () => {
    const vysledek = nabidkaSlozek([slozka({ prideleno: false })], true);
    expect(vysledek).toHaveLength(1);
    expect(vysledek[0].nazev).toBe('Klientská zóna');
  });

  it('složku s nečitelným odkazem vynechá - stejně by se neotevřela', () => {
    expect(nabidkaSlozek([slozka({ rootId: null })], true)).toEqual([]);
  });

  it('zachová pořadí, ve kterém složky přišly z administrace', () => {
    const vysledek = nabidkaSlozek(
      [
        slozka({ id: 'a', nazev: 'Dokumenty' }),
        slozka({ id: 'b', nazev: 'Marketing', prideleno: false }),
        slozka({ id: 'c', nazev: 'Klientská zóna' }),
      ],
      false,
    );
    expect(vysledek.map((s) => s.nazev)).toEqual(['Dokumenty', 'Klientská zóna']);
  });
});
