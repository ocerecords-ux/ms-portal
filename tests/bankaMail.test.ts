import { describe, expect, it } from 'vitest';
import { castkaNaMinor, oznacMail, rozeberMailOPohybu } from '../src/lib/bankaMail';

/**
 * ČTENÍ UPOZORNĚNÍ Z BANKY (29. 9. 2026).
 *
 * Banka znění svých e-mailů nikde nezveřejňuje a časem si je mění, takže tenhle
 * test nehlídá jedno konkrétní znění, ale to, že parser přežije rozumné
 * varianty: štítky i věty, HTML převedené na text, částku odlišenou od
 * zůstatku a odchozí platbu se správným znaménkem.
 *
 * Až dorazí první opravdový e-mail, jeho text sem patří jako další případ -
 * teprve tím je čtení zafixované na to, co banka opravdu posílá.
 */

describe('castkaNaMinor', () => {
  it('bere české i strojové psaní částek', () => {
    expect(castkaNaMinor('1 234,50')).toBe(123450);
    expect(castkaNaMinor('1234.5')).toBe(123450);
    expect(castkaNaMinor('1.234,50')).toBe(123450);
    expect(castkaNaMinor('12 000')).toBe(1200000);
    expect(castkaNaMinor('0,01')).toBe(1);
  });

  it('co není číslo, nevrací', () => {
    expect(castkaNaMinor('')).toBeNull();
    expect(castkaNaMinor('nic')).toBeNull();
  });
});

describe('rozeberMailOPohybu', () => {
  it('přečte příchozí platbu ze štítkového znění', () => {
    const pohyb = rozeberMailOPohybu('Změna zůstatku na účtu 2901234567', [
      'Dobrý den,',
      'na účet 2901234567/3030 vám byla připsána platba.',
      'Částka: 31 200,00 Kč',
      'Protiúčet: 123456789/0300',
      'Odesílatel: AUDIOTEKA CZ s.r.o.',
      'Variabilní symbol: 2026041',
      'Specifický symbol: 55',
      'Zpráva pro příjemce: faktura 2026041',
      'Zůstatek na účtu: 1 250 000,00 Kč',
    ].join('\n'));

    expect(pohyb).not.toBeNull();
    expect(pohyb!.castkaMinor).toBe(3_120_000);
    expect(pohyb!.mena).toBe('CZK');
    expect(pohyb!.variabilniSymbol).toBe('2026041');
    expect(pohyb!.specifickySymbol).toBe('55');
    // Náš účet a protiúčet se nesmí zaměnit, i když oba stojí ve stejném textu.
    expect(pohyb!.ucet).toBe('2901234567/3030');
    expect(pohyb!.protiucet).toBe('123456789/0300');
    expect(pohyb!.protistrana).toContain('AUDIOTEKA');
    expect(pohyb!.zprava).toContain('2026041');
  });

  it('nesplete si částku pohybu se zůstatkem', () => {
    const pohyb = rozeberMailOPohybu(
      'Info o dění na účtu',
      'Zůstatek na účtu je 1 250 000,00 Kč. Připsali jsme vám 31 200,00 Kč.',
    );
    expect(pohyb!.castkaMinor).toBe(3_120_000);
  });

  it('odchozí platbu označí záporně a nevydá cizí účet za náš', () => {
    const pohyb = rozeberMailOPohybu(
      'Změna zůstatku',
      'Z účtu jsme odepsali 1 500,00 Kč ve prospěch účtu 987654321/0800.',
    );
    expect(pohyb!.castkaMinor).toBe(-150_000);
    expect(pohyb!.protiucet).toBe('987654321/0800');
    expect(pohyb!.ucet).toBeNull();
    // „od" nesmí zabrat uvnitř slova „odepsali".
    expect(pohyb!.protistrana).toBeNull();
  });

  it('číslo účtu s kódem banky má přednost před holým z předmětu', () => {
    const pohyb = rozeberMailOPohybu(
      'Info o dění na účtu 2901234567',
      'Na účet 2901234567/3030 vám přišla platba. Částka: 900,00 Kč. Protiúčet: 111222333/0800. Variabilní symbol: 7.',
    );
    expect(pohyb!.ucet).toBe('2901234567/3030');
    expect(pohyb!.protiucet).toBe('111222333/0800');
    expect(pohyb!.variabilniSymbol).toBe('7');
  });

  it('poradí si s textem vytaženým z HTML a s VS bez plného názvu', () => {
    const pohyb = rozeberMailOPohybu('Připsaná platba', 'Přišlo vám\n900,00 Kč\nVS: 0000123456\nKS: 0308');
    expect(pohyb!.castkaMinor).toBe(90_000);
    expect(pohyb!.variabilniSymbol).toBe('123456');
    expect(pohyb!.konstantniSymbol).toBe('308');
  });

  it('cizí měnu vezme, jak je napsaná', () => {
    const pohyb = rozeberMailOPohybu('Platba', 'Připsali jsme vám 250,00 EUR.');
    expect(pohyb!.mena).toBe('EUR');
    expect(pohyb!.castkaMinor).toBe(25_000);
  });

  it('e-mail bez částky není pohyb', () => {
    expect(rozeberMailOPohybu('Novinky z banky', 'Máme pro vás nové výhody.')).toBeNull();
    expect(rozeberMailOPohybu('', '')).toBeNull();
  });

  it('označení pohybu drží e-mail, ne částku', () => {
    expect(oznacMail('<abc@airbank.cz>')).toBe('mail:<abc@airbank.cz>');
  });
});
