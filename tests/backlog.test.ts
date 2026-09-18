import { describe, expect, it } from 'vitest';
import {
  filtrujDruh,
  omezObdobi,
  poMesicich,
  souhrnBacklogu,
  znamenkoDni,
  type ZaznamBacklogu,
} from '../src/lib/backlog';

function z(
  id: string,
  odevzdano: string,
  skluz: number,
  reklama = false,
): ZaznamBacklogu {
  return {
    caflouProjectId: id,
    nazev: id,
    typ: null,
    reklama,
    termin: '2026-09-01',
    odevzdano,
    skluz,
  };
}

const DATA = [
  z('a', '2026-07-10', 2),
  z('b', '2026-09-05', -3),
  z('c', '2026-09-12', 0),
  z('d', '2026-09-15', -1, true),
];

describe('backlog', () => {
  it('sečte dny k dobru i skluz zvlášť', () => {
    const s = souhrnBacklogu(DATA);
    expect(s.pocet).toBe(4);
    expect(s.vTerminu).toBe(2); // nula je jeste v terminu
    expect(s.poTerminu).toBe(2);
    expect(s.procentVTerminu).toBe(50);
    expect(s.dniPredem).toBe(2);
    expect(s.dniPoTerminu).toBe(4);
    expect(s.celkem).toBe(-2);
    expect(s.prumer).toBe(-0.5);
    expect(s.nejdelsiSkluz).toBe(3);
  });

  it('odděluje reklamy od audioknih', () => {
    expect(filtrujDruh(DATA, 'REKLAMA')).toHaveLength(1);
    expect(filtrujDruh(DATA, 'AUDIOKNIHA')).toHaveLength(3);
    expect(filtrujDruh(DATA, 'VSE')).toHaveLength(4);
  });

  it('nevynechá prázdný měsíc uprostřed', () => {
    const mesice = poMesicich(DATA);
    expect(mesice.map((m) => m.klic)).toEqual(['2026-07', '2026-08', '2026-09']);
    expect(mesice[1].vTerminu + mesice[1].poTerminu).toBe(0);
    expect(mesice[2].dni).toBe(-4);
  });

  it('počítá období od prvního dne měsíce', () => {
    const dnes = new Date(2026, 8, 18);
    expect(omezObdobi(DATA, 3, dnes)).toHaveLength(4);
    expect(omezObdobi(DATA, 2, dnes)).toHaveLength(3);
    expect(omezObdobi(DATA, null, dnes)).toHaveLength(4);
  });

  it('píše znaménko stejně jako přehled projektů', () => {
    expect(znamenkoDni(3)).toBe('+3');
    expect(znamenkoDni(-3)).toBe('−3');
    expect(znamenkoDni(0)).toBe('0');
  });
});
