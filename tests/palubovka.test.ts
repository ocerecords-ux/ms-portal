import { describe, expect, it } from 'vitest';
import {
  koruny,
  korunyKratce,
  palivomer,
  popisMesicu,
  prumerPoslednich,
  tachometr,
  zmenaProcent,
} from '../src/lib/palubovka';

/**
 * Budíky palubovky (zadání 27. 9. 2026). Hlídá se hlavně to, co by se dalo
 * snadno splést: měsíc se počítá poměrně, aby budík nesvítil červeně každého
 * prvního, a palivo se měří proti cílovému krytí, ne proti pevnému číslu.
 */
describe('tachometr', () => {
  it('třetina cíle v třetině měsíce je v pořádku', () => {
    expect(tachometr(100_000, 300_000, 10, 30).stav).toBe('DOBRE');
  });

  it('polovina toho, co už mělo být, je varování nebo hůř', () => {
    expect(tachometr(50_000, 300_000, 10, 30).stav).toBe('SPATNE');
  });

  it('mírné zaostání je jen k hlídání', () => {
    // 80 % z očekávaných 100 000 → naPlánu 0,8.
    expect(tachometr(80_000, 300_000, 10, 30).stav).toBe('HLIDAT');
  });

  it('bez cíle nepředstírá, že něco ví', () => {
    const b = tachometr(100_000, null, 10, 30);
    expect(b.stav).toBe('HLIDAT');
    expect(b.popis).toContain('Není zadaný');
  });

  it('první den měsíce nespadne do červené kvůli dělení nulou', () => {
    expect(tachometr(0, 300_000, 1, 31).pomer).toBe(0);
  });
});

describe('palivomer', () => {
  it('nad cílovým krytím je dobře', () => {
    expect(palivomer(3, 2).stav).toBe('DOBRE');
  });

  it('pod polovinou krytí je potřeba přidat', () => {
    expect(palivomer(0.8, 2).stav).toBe('SPATNE');
  });

  it('stupnice končí na dvojnásobku cíle', () => {
    expect(palivomer(4, 2).pomer).toBe(1);
  });
});

describe('drobnosti', () => {
  it('měsíce se píšou česky', () => {
    expect(popisMesicu(0.5)).toBe('15 dní');
    expect(popisMesicu(1.2)).toBe('měsíc');
    expect(popisMesicu(2.4)).toBe('2,4 měsíce');
  });

  it('koruny bez haléřů, zkrácené po tisících', () => {
    expect(koruny(1_234_567.89)).toContain('1 234 568');
    expect(korunyKratce(1_234_567)).toBe('1,2 mil.');
    expect(korunyKratce(450_000)).toBe('450 tis.');
  });

  it('změna proti nule není nekonečno, ale nic', () => {
    expect(zmenaProcent(120, 100)).toBe(20);
    expect(zmenaProcent(80, 0)).toBeNull();
  });

  it('průměr bere jen uzavřené měsíce, ne ten rozjetý', () => {
    const rady = [...Array(13)].map((_, i) => ({
      rok: 2026,
      mesic: i + 1,
      vyfakturovano: (i + 1) * 1000,
      uhrazeno: 0,
    }));
    // Poslední (13 000) je rozjetý měsíc; průměr z 10, 11 a 12.
    expect(prumerPoslednich(rady, 3)).toBe(11_000);
  });
});
