import { describe, expect, it } from 'vitest';
import {
  DNU_NA_PRIPRAVU,
  jeVikend,
  posledniDenFrekvence,
  prvniDenFrekvence,
  spocitejVolnaMista,
  type StudioProNabidku,
} from '../src/lib/volnaMista';

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
  it('nabídne obě okna v každém všedním dni a víkend vynechá', () => {
    const mista = spocitejVolnaMista(zaklad);
    // Po-Pa po dvou oknech; sobota a nedele uz nic (30. 9. 2026).
    expect(mista).toHaveLength(10);
    expect(mista.filter((m) => m.poDomluve)).toHaveLength(0);
    // 9:00 v Brne v zari = 7:00 UTC
    expect(mista[0].start.toISOString()).toBe('2026-09-21T07:00:00.000Z');
    // Posledni misto je v patek 25. 9., ne v nedeli.
    expect(mista[9].end.toISOString()).toBe('2026-09-25T15:00:00.000Z');
  });

  it('víkend nenabídne, ani když má studio na sobotu běžnou otevírací dobu', () => {
    const sVikendemNaOstro: StudioProNabidku = {
      ...brno,
      hours: [...PRACOVNI, { weekday: 6, startMinutes: 9 * 60, endMinutes: 17 * 60, byArrangement: false }],
    };
    const mista = spocitejVolnaMista({
      ...zaklad,
      studia: [sVikendemNaOstro],
      od: '2026-09-26',
      doo: '2026-09-26',
    });
    expect(mista).toHaveLength(0);
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
    expect(mista).toHaveLength(12);
    expect(mista.some((m) => m.start.toISOString() === '2026-09-21T07:00:00.000Z')).toBe(false);
    expect(mista.some((m) => m.start.toISOString() === '2026-09-23T11:00:00.000Z')).toBe(false);
  });

  it('nenabídne nic před nejdřívějším okamžikem', () => {
    // Streda az patek po dvou oknech.
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
  it('jsou dva dny před dokončením', () => {
    expect(posledniDenFrekvence('2026-10-01')).toBe('2026-09-29');
  });
});

describe('prvniDenFrekvence', () => {
  it('je za týden (zadání 30. 9. 2026)', () => {
    expect(DNU_NA_PRIPRAVU).toBe(7);
    expect(prvniDenFrekvence(new Date('2026-09-30T09:00:00Z'))).toBe('2026-10-07');
  });

  it('počítá se podle dne v Praze, ne podle UTC', () => {
    // 30. 9. 23:30 v Praze je uz 21:30 UTC tehoz dne - vychazi 7. 10.
    expect(prvniDenFrekvence(new Date('2026-09-30T21:30:00Z'))).toBe('2026-10-07');
    // 1. 10. 00:30 v Praze je 30. 9. 22:30 UTC - uz se pocita od 1. 10.
    expect(prvniDenFrekvence(new Date('2026-09-30T22:30:00Z'))).toBe('2026-10-08');
  });
});

describe('jeVikend', () => {
  it('pozná sobotu a neděli', () => {
    expect(jeVikend(0)).toBe(true);
    expect(jeVikend(6)).toBe(true);
    expect([1, 2, 3, 4, 5].some(jeVikend)).toBe(false);
  });
});
