import { describe, expect, it } from 'vitest';
import { hledaUkol, jeUkol, nazevUkolu } from '../src/lib/ukolyZChatu';

describe('úkol z chatu', () => {
  it('pozná značku na začátku i uprostřed věty', () => {
    expect(jeUkol('@ukol zavolat do studia')).toBe(true);
    expect(jeUkol('@úkol zavolat do studia')).toBe(true);
    expect(jeUkol('Hele @ukol poslat fakturu')).toBe(true);
  });

  it('nezamění ji za jiné slovo ani za zmínku', () => {
    expect(jeUkol('máme tu ukol')).toBe(false);
    expect(jeUkol('@ukolnice něco')).toBe(false);
    expect(jeUkol('@Bára mrkni na to')).toBe(false);
  });

  it('vezme text a vyhodí značku i zmínku příjemce', () => {
    expect(nazevUkolu('@ukol @Bára Šiblová zavolat do studia', 'Bára Šiblová')).toBe('zavolat do studia');
    expect(nazevUkolu('@ukol @Bára zavolat do studia', 'Bára Šiblová')).toBe('zavolat do studia');
    expect(nazevUkolu('@ukol zavolat do studia')).toBe('zavolat do studia');
  });

  it('ostatní zmínky ve větě nechá být', () => {
    expect(nazevUkolu('@ukol @Bára domluvit to s @Karolínou', 'Bára')).toBe('domluvit to s @Karolínou');
  });

  it('nabídne se v nabídce pod @ už po prvních písmenech', () => {
    expect(hledaUkol('')).toBe(true);
    expect(hledaUkol('u')).toBe(true);
    expect(hledaUkol('uko')).toBe(true);
    expect(hledaUkol('ú')).toBe(true);
    expect(hledaUkol('bár')).toBe(false);
  });
});
