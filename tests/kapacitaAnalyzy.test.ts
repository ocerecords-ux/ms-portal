import { describe, expect, it } from 'vitest';
import { analyzaRoku, csvKapacity } from '../src/lib/kapacitaAnalyzy';
import type { KapacitaRoku } from '../src/lib/kapacitaServer';

/**
 * Analýzy obsazenosti (zadání 20. 9. 2026). Malý umělý rok: jedno studio,
 * dvě frekvence, jeden leden se dvěma dny.
 */
function prehled(): KapacitaRoku {
  const den = (den: number, denVTydnu: number, rano: number, odpo: number) => ({
    den,
    denVTydnu,
    vikend: denVTydnu === 0 || denVTydnu === 6,
    bunky: [
      {
        kapacitaMinut: 480,
        natoceno: rano + odpo,
        pocet: (rano > 0 ? 1 : 0) + (odpo > 0 ? 1 : 0),
        casti: [
          { oknoMinut: 240, kapacitaMinut: 240, natoceno: rano, pocet: rano > 0 ? 1 : 0 },
          { oknoMinut: 240, kapacitaMinut: 240, natoceno: odpo, pocet: odpo > 0 ? 1 : 0 },
        ],
      },
    ],
  });
  return {
    rok: 2026,
    studia: [
      {
        id: 's1',
        nazev: 'Brno I',
        barva: '#7B55FF',
        frekvence: [
          { popis: '9-13', od: 540, do: 780 },
          { popis: '13-17', od: 780, do: 1020 },
        ],
        kapacitaMinut: 960,
        natoceno: 600,
        dnuSNatacenim: 2,
      },
    ],
    mesice: [
      { mesic: 1, dny: [den(1, 4, 240, 120), den(2, 5, 240, 0)], kapacitaMinut: 960, natoceno: 600 },
      ...Array.from({ length: 11 }, (_, i) => ({ mesic: i + 2, dny: [], kapacitaMinut: 0, natoceno: 0 })),
    ],
  };
}

describe('analýzy obsazenosti', () => {
  it('měsíc spočítá procenta i hodiny', () => {
    const a = analyzaRoku(prehled());
    expect(a.mesice[0].natoceno).toBe(600);
    expect(a.mesice[0].procenta).toBe(63); // 600 z 960
    expect(a.mesice[1].procenta).toBeNull();
  });
  it('den v týdnu sedí na správném dni', () => {
    const a = analyzaRoku(prehled());
    expect(a.dnyVTydnu[4].natoceno).toBe(360); // čtvrtek
    expect(a.dnyVTydnu[5].natoceno).toBe(240); // pátek
    expect(a.dnyVTydnu[1].natoceno).toBe(0);
  });
  it('ranní frekvence je plná, odpolední z poloviny', () => {
    const a = analyzaRoku(prehled());
    expect(a.frekvence[0].okna[0].procenta).toBe(100); // 480 ze 480
    expect(a.frekvence[0].okna[1].procenta).toBe(25); // 120 ze 480
  });
  it('CSV má hlavičku a řádek na každou frekvenci dne', () => {
    const csv = csvKapacity(prehled()).split('\n');
    expect(csv[0]).toContain('datum;den v tydnu');
    expect(csv).toHaveLength(1 + 4);
    expect(csv[1]).toBe('2026-01-01;čtvrtek;ne;Brno I;9-13;4,00;4,00;100;1');
  });
});
