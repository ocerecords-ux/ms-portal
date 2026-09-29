import { describe, expect, it } from 'vitest';
import { oznacPohyb, rozeberAbo } from '../src/lib/abo';

/**
 * ČTENÍ ABO VÝPISU (29. 9. 2026).
 *
 * Řádky se skládají podle pozic ze specifikace Air Bank, ne opsáním
 * ukázkového souboru - test tím hlídá právě to, na čem parser stojí. Kdyby
 * se někde posunulo pole o znak, spadne to tady, ne až u faktury, která se
 * omylem označí jako uhrazená.
 */

/** Poskládá větu 075 z polí na správné pozice a doplní na 128 znaků. */
function veta075(vstup: {
  ucet: string;
  protiucet: string;
  doklad: string;
  castka: string;
  kod: string;
  vs: string;
  ks?: string;
  kodBanky?: string;
  ss?: string;
  valuta: string;
  popis?: string;
}): string {
  const naDelku = (text: string, delka: number, cislo = false) =>
    cislo ? text.padStart(delka, '0').slice(-delka) : text.padEnd(delka, ' ').slice(0, delka);

  return (
    '075' +
    naDelku(vstup.ucet, 16, true) +
    naDelku(vstup.protiucet, 16, true) +
    naDelku(vstup.doklad, 13) +
    naDelku(vstup.castka, 12, true) +
    naDelku(vstup.kod, 1) +
    naDelku(vstup.vs, 10, true) +
    naDelku(vstup.ks ?? '', 4, true) +
    naDelku(vstup.kodBanky ?? '0300', 4, true) +
    '00' +
    naDelku(vstup.ss ?? '', 10, true) +
    naDelku(vstup.valuta, 6) +
    naDelku(vstup.popis ?? '', 20) +
    ' ' +
    '0000' +
    naDelku(vstup.valuta, 6)
  );
}

const HLAVICKA =
  '074' +
  '2901234567'.padStart(16, '0') +
  'MEDIA SPACE s.r.o. '.padEnd(20, ' ') +
  '010926' +
  '0'.repeat(14) +
  '+' +
  '0'.repeat(14) +
  '+' +
  '0'.repeat(14) +
  '0' +
  '0'.repeat(14) +
  '0' +
  '009' +
  '300926';

describe('rozeberAbo', () => {
  it('přečte příchozí platbu i s variabilním symbolem', () => {
    const vypis = rozeberAbo(
      [
        HLAVICKA,
        veta075({
          ucet: '2901234567',
          protiucet: '123456789',
          doklad: 'D2026001',
          castka: '3120000',
          kod: '2',
          vs: '2026041',
          valuta: '280926',
          popis: 'AUDIOTEKA CZ',
        }),
      ].join('\r\n'),
    );

    expect(vypis).not.toBeNull();
    expect(vypis!.ucet).toBe('2901234567');
    expect(vypis!.cisloVypisu).toBe('9');
    expect(vypis!.pohyby).toHaveLength(1);

    const p = vypis!.pohyby[0];
    expect(p.castkaMinor).toBe(3_120_000);
    expect(p.variabilniSymbol).toBe('2026041');
    expect(p.protiucet).toBe('123456789/0300');
    expect(p.popis).toBe('AUDIOTEKA CZ');
    expect(p.datum.toISOString().slice(0, 10)).toBe('2026-09-28');
  });

  it('odchozí platbu označí záporně', () => {
    const vypis = rozeberAbo(
      [
        HLAVICKA,
        veta075({
          ucet: '2901234567',
          protiucet: '987654321',
          doklad: 'D2026002',
          castka: '150000',
          kod: '1',
          vs: '',
          valuta: '280926',
        }),
      ].join('\n'),
    );

    expect(vypis!.pohyby[0].castkaMinor).toBe(-150_000);
    // Samé nuly ve variabilním symbolu znamenají „nevyplněno", ne nulu.
    expect(vypis!.pohyby[0].variabilniSymbol).toBeNull();
  });

  it('storno debetu je příjem a storno kreditu výdaj', () => {
    const radek = (kod: string) =>
      veta075({
        ucet: '2901234567',
        protiucet: '111',
        doklad: 'S1',
        castka: '1000',
        kod,
        vs: '1',
        valuta: '280926',
      });

    expect(rozeberAbo([HLAVICKA, radek('4')].join('\n'))!.pohyby[0].castkaMinor).toBe(1000);
    expect(rozeberAbo([HLAVICKA, radek('5')].join('\n'))!.pohyby[0].castkaMinor).toBe(-1000);
  });

  it('soubor bez obratových položek není výpis', () => {
    expect(rozeberAbo(HLAVICKA)).toBeNull();
    expect(rozeberAbo('')).toBeNull();
    expect(rozeberAbo('něco úplně jiného')).toBeNull();
  });

  it('označení pohybu drží stejné napříč nahráními a liší se částkou', () => {
    const vypis = rozeberAbo(
      [
        HLAVICKA,
        veta075({
          ucet: '2901234567',
          protiucet: '123456789',
          doklad: 'D2026001',
          castka: '3120000',
          kod: '2',
          vs: '2026041',
          valuta: '280926',
        }),
      ].join('\n'),
    )!;

    const znacka = oznacPohyb(vypis.ucet, vypis.pohyby[0]);
    expect(znacka).toBe('abo:2901234567:2026-09-28:D2026001:3120000');

    const jina = oznacPohyb(vypis.ucet, { ...vypis.pohyby[0], castkaMinor: 3_120_001 });
    expect(jina).not.toBe(znacka);
  });
});
