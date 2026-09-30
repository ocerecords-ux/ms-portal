import { describe, expect, it } from 'vitest';
import {
  koeficientKnihy,
  progresProjektu,
  progresZeStran,
  rozdelPodleNormostran,
} from '../src/lib/progresNataceni';

/**
 * Progres natáčení a koeficient převodu PDF ↔ normostrany (zadání
 * 30. 9. 2026: „musíme u každé knihy spočítat koeficient převodu z pdf na
 * normostrany. U každého herce jsou pak jasné poměry. Ten poměr je jasně
 * daný z NS" + „každá kniha ale bude mít jiný koeficient, musíme to vždycky
 * přepočítat").
 *
 * Čísla v testech jsou ze skutečného projektu, na kterém se to vyhmátlo:
 * 670 stran PDF, 328 normostran, dva herci.
 */
describe('koeficient knihy', () => {
  it('je poměr stran PDF k normostranám', () => {
    const k = koeficientKnihy(670, 328);
    expect(k?.stranNaNs).toBeCloseTo(2.043, 3);
  });

  it('u hustěji vysázené knihy vyjde jiný - proto se počítá vždycky znovu', () => {
    const rida = koeficientKnihy(670, 328)?.stranNaNs ?? 0;
    const husta = koeficientKnihy(400, 328)?.stranNaNs ?? 0;
    expect(husta).toBeLessThan(rida);
  });

  it('bez jednoho z čísel není co počítat', () => {
    expect(koeficientKnihy(null, 328)).toBeNull();
    expect(koeficientKnihy(670, null)).toBeNull();
    expect(koeficientKnihy(670, 0)).toBeNull();
  });
});

describe('rozdělení textu mezi herce', () => {
  it('díl vyjde z normostran herce krát koeficient, ne z půlení textu', () => {
    const { dily, koeficient } = rozdelPodleNormostran(
      [
        { klic: 'martina', normostrany: 100 },
        { klic: 'tomas', normostrany: 228 },
      ],
      670,
      328,
    );
    expect(koeficient?.stranNaNs).toBeCloseTo(2.043, 3);
    // 100 NS × 2,043 = 204 stran, ne polovina z 670.
    expect(dily.martina).toEqual({ od: 1, do: 204 });
    expect(dily.tomas).toEqual({ od: 205, do: 670 });
  });

  it('poslední herec vždycky končí na poslední straně', () => {
    const { dily } = rozdelPodleNormostran(
      [
        { klic: 'a', normostrany: 111 },
        { klic: 'b', normostrany: 111 },
        { klic: 'c', normostrany: 111 },
      ],
      670,
      333,
    );
    expect(dily.c.do).toBe(670);
    expect(dily.a.od).toBe(1);
  });

  it('když někomu chybí rozsah, žádný díl se nevymyslí', () => {
    const v = rozdelPodleNormostran(
      [
        { klic: 'martina', normostrany: 158 },
        { klic: 'tomas', normostrany: 0 },
      ],
      670,
      328,
    );
    expect(v.dily).toEqual({});
    expect(v.bezNormostran).toEqual(['tomas']);
  });

  it('rozchod součtu s rozsahem knihy ohlásí, ale počítat nepřestane', () => {
    const v = rozdelPodleNormostran(
      [
        { klic: 'a', normostrany: 324 },
        { klic: 'b', normostrany: 346 },
      ],
      670,
      328,
    );
    expect(v.nesoulad).toEqual({ soucetHercu: 670, kniha: 328 });
    expect(v.dily.b.do).toBe(670);
  });

  it('u jediného herce se nedělí', () => {
    expect(rozdelPodleNormostran([{ klic: 'a', normostrany: 328 }], 670, 328).dily).toEqual({});
  });
});

describe('progres herce v jeho dílu', () => {
  it('počítá se uvnitř dílu, ne proti celé knize', () => {
    const p = progresZeStran(95, 670, false, { od: 1, do: 324 });
    expect(p?.procenta).toBe(29);
    expect(p?.zbyva).toBe(229);
    expect(p?.mimoDil).toBe(false);
  });

  it('zápis před začátkem dílu je rozpor, ne nula bez vysvětlení', () => {
    const p = progresZeStran(222, 670, false, { od: 325, do: 670 });
    expect(p?.procenta).toBe(0);
    expect(p?.mimoDil).toBe(true);
  });

  it('herec, který ještě nezačal, rozpor nehlásí', () => {
    const p = progresZeStran(null, 670, false, { od: 325, do: 670 });
    expect(p?.procenta).toBe(0);
    expect(p?.mimoDil).toBe(false);
  });
});

describe('souhrn projektu', () => {
  it('je vážený podle dílů, ne průměr herců', () => {
    // Kratší díl hotový, delší nezačatý: průměr by tvrdil 50 %.
    const maly = progresZeStran(100, 670, false, { od: 1, do: 100 });
    const velky = progresZeStran(null, 670, false, { od: 101, do: 670 });
    const celkem = progresProjektu([maly, velky]);
    expect(celkem?.procenta).toBe(15);
  });

  it('rozpor u herce je vidět i v souhrnu', () => {
    const a = progresZeStran(95, 670, false, { od: 1, do: 324 });
    const b = progresZeStran(222, 670, false, { od: 325, do: 670 });
    expect(progresProjektu([a, b])?.mimoDil).toBe(true);
  });
});
