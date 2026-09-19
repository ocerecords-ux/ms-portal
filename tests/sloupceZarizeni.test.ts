import { describe, expect, it } from 'vitest';
import { PROJECTS_TABLE_KEY, defaultColumns, sloupceProZarizeni, visibleColumns } from '../src/lib/columnLabels';

/** Sloupce zvlášť pro počítač a mobil (zadání 19. 9. 2026). */
const spolecne = defaultColumns(PROJECTS_TABLE_KEY);
const klice = (cols: { key: string }[]) => cols.map((c) => c.key).join(',');

describe('sloupceProZarizeni', () => {
  it('bez nastavení: počítač = společná podoba, mobil = název, datum, stav', () => {
    expect(klice(sloupceProZarizeni(PROJECTS_TABLE_KEY, spolecne, [], 'POCITAC'))).toBe(klice(spolecne));
    const mobil = sloupceProZarizeni(PROJECTS_TABLE_KEY, spolecne, [], 'MOBIL');
    expect(klice(visibleColumns(mobil))).toBe('name,endDate,statusName');
    expect(mobil.length).toBe(spolecne.length);
  });

  it('použije uložené pořadí a skrytí, nové sloupce přidá na konec', () => {
    const ulozene = [
      { columnKey: 'statusName', sortOrder: 0, hidden: false },
      { columnKey: 'name', sortOrder: 1, hidden: false },
      { columnKey: 'companyName', sortOrder: 2, hidden: true },
    ];
    const mobil = sloupceProZarizeni(PROJECTS_TABLE_KEY, spolecne, ulozene, 'MOBIL');
    expect(klice(visibleColumns(mobil))).toBe('statusName,name');
    const pocitac = sloupceProZarizeni(PROJECTS_TABLE_KEY, spolecne, ulozene, 'POCITAC');
    expect(klice(visibleColumns(pocitac)).startsWith('statusName,name,')).toBe(true);
  });

  it('když by nezbyl žádný sloupec, vrátí výchozí', () => {
    const vse = spolecne.map((c, i) => ({ columnKey: c.key, sortOrder: i, hidden: true }));
    expect(klice(visibleColumns(sloupceProZarizeni(PROJECTS_TABLE_KEY, spolecne, vse, 'MOBIL')))).toBe(
      'name,endDate,statusName',
    );
  });
});
