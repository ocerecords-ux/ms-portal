import { describe, expect, it } from 'vitest';
import { posledniDenFrekvence, spocitejVolnaMista, type StudioProNabidku } from '../src/lib/volnaMista';

/**
 * Automatická nabídka termínů (zadání 19. 9. 2026): nabízí se všechna volná
 * místa ve studiích herce až do poslední možné frekvence, kromě obsazených.
 */
const PRACOVNI = [1, 2, 3, 4, 5].map((weekday) => ({
  weekday,
  startMinutes: 8 * 60,
  endMinutes: 18 * 60,
  byArrangement: false,
}));
const VIKEND = [0, 6].map((weekday) => ({ weekday, startMinutes: 9 * 60, endMinutes: 17 * 60, byArrangement: true }));

const brno: StudioProNabidku = {
  id: 'brno1',
  timezone: 'Europe/Prague',
  hours: [...PRACOVNI, ...VIKEND],
  presets: [
    { startMinutes: 9 * 60, endMinutes: 13 * 60 },
    { startMinutes: 13 * 60, endMinutes: 17 * 60 },
  ],
};

// Pondeli 21. 9. 2026 - nedele 27. 9. 2026
const zaklad = {
  studia: [brno],
  od: '2026-09-21',
  doo: '2026-09-27',
  delkaMinut: 240,
  obsazeno: [],
  hercovy: [],
  nejdrive: new Date('2026-09-20T00:00:00Z'),
};

describe('spocitejVolnaMista', () => {
  it('nabídne obě okna v každém pracovním dni, víkend ne', () => {
    const mista = spocitejVolnaMista(zaklad);
    expect(mista).toHaveLength(10);
    // 9:00 v Brne v zari = 7:00 UTC
    expect(mista[0].start.toISOString()).toBe('2026-09-21T07:00:00.000Z');
    expect(mista[9].end.toISOString()).toBe('2026-09-25T15:00:00.000Z');
  });

  it('vynechá obsazené studio a jiné natáčení herce', () => {
    const mista = spocitejVolnaMista({
      ...zaklad,
      obsazeno: [
        { id: 'x', studioId: 'brno1', start: new Date('2026-09-21T08:00:00Z'), end: new Date('2026-09-21T09:00:00Z') },
        // Jine studio - tady nevadi.
        { id: 'y', studioId: 'praha', start: new Date('2026-09-22T07:00:00Z'), end: new Date('2026-09-22T15:00:00Z') },
      ],
      hercovy: [{ id: 'z', start: new Date('2026-09-23T12:00:00Z'), end: new Date('2026-09-23T13:00:00Z') }],
    });
    expect(mista).toHaveLength(8);
    expect(mista.some((m) => m.start.toISOString() === '2026-09-21T07:00:00.000Z')).toBe(false);
    expect(mista.some((m) => m.start.toISOString() === '2026-09-23T11:00:00.000Z')).toBe(false);
  });

  it('nenabídne nic před nejdřívějším okamžikem', () => {
    const mista = spocitejVolnaMista({ ...zaklad, nejdrive: new Date('2026-09-23T00:00:00Z') });
    expect(mista).toHaveLength(6);
  });

  it('studio bez zkratek rozdělí pracovní dobu na frekvence', () => {
    const mista = spocitejVolnaMista({ ...zaklad, studia: [{ ...brno, presets: [] }], doo: '2026-09-21' });
    // 8-12, 12-16 (16-20 uz se do 18:00 nevejde)
    expect(mista).toHaveLength(2);
  });
});

describe('posledniDenFrekvence', () => {
  it('je den před odevzdáním', () => {
    expect(posledniDenFrekvence('2026-10-01')).toBe('2026-09-30');
  });
});
