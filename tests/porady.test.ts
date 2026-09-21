import { describe, expect, it } from 'vitest';
import { vyskytyPorady, platnyOdkaz } from '../src/lib/porady';
import { zonedToUtc } from '../src/lib/calendar';

/** Porady (21. 9. 2026): opakování se dopočítává v pražském čase. */
describe('vyskytyPorady', () => {
  const start = zonedToUtc(2026, 9, 21, 9 * 60, 'Europe/Prague'); // po 21. 9. 9:00
  const end = new Date(start.getTime() + 3600e3);
  const od = new Date('2026-10-19T00:00:00Z');
  const doKdy = new Date('2026-11-09T00:00:00Z');

  it('každý týden drží 9:00 i po přechodu na zimní čas a vynechá zrušený termín', () => {
    const v = vyskytyPorady({ start, end, opakovani: 'TYDNE', opakovatDo: null, vynechano: ['2026-10-26'] }, od, doKdy);
    expect(v.map((x) => x.den)).toEqual(['2026-10-19', '2026-11-02']);
    expect(v[0].start.toISOString()).toBe('2026-10-19T07:00:00.000Z'); // letní čas
    expect(v[1].start.toISOString()).toBe('2026-11-02T08:00:00.000Z'); // zimní čas
  });

  it('pracovní dny vynechají víkend', () => {
    const v = vyskytyPorady({ start, end, opakovani: 'PRACOVNI_DNY', opakovatDo: '2026-10-25', vynechano: [] }, od, doKdy);
    expect(v.map((x) => x.den)).toEqual(['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23']);
  });

  it('neopakovaná mimo rozsah nic nevrátí', () => {
    expect(vyskytyPorady({ start, end, opakovani: 'NE', opakovatDo: null, vynechano: [] }, od, doKdy)).toEqual([]);
  });
});

describe('platnyOdkaz', () => {
  it('doplní https a odmítne nesmysl', () => {
    expect(platnyOdkaz('meet.google.com/abc-defg-hij')).toBe('https://meet.google.com/abc-defg-hij');
    expect(platnyOdkaz('javascript:alert(1)')).toBeNull();
    expect(platnyOdkaz('')).toBeNull();
  });
});
