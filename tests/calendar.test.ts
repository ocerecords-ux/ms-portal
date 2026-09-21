import { describe, expect, it } from 'vitest';
import {
  ALLOWED_TRANSITIONS,
  canTransition,
  checkOpeningHours,
  findCollisions,
  overlaps,
  remainingToPick,
  sessionsForPages,
  zonedToUtc,
  minutesInZone,
  weekdayInZone,
} from '../src/lib/calendar';

// Pracovni doba: 8-20 kazdy den, vikend jen po domluve (jako v seedu).
const HODINY = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
  weekday,
  startMinutes: 8 * 60,
  endMinutes: 20 * 60,
  byArrangement: weekday === 0 || weekday === 6,
}));

/** 12. 9. 2026 je sobota; 14. 9. 2026 pondeli. */
const brno = (den: number, minuty: number) => zonedToUtc(2026, 9, den, minuty, 'Europe/Prague');

describe('počet frekvencí', () => {
  it('počítá podle zadání: 40 NS = 1 frekvence', () => {
    expect(sessionsForPages(40, 40)).toBe(1);
    expect(sessionsForPages(80, 40)).toBe(2);
    expect(sessionsForPages(100, 40)).toBe(3);
    expect(sessionsForPages(150, 40)).toBe(4);
  });

  it('zaokrouhluje vždycky nahoru a nepadá na nule', () => {
    expect(sessionsForPages(1, 40)).toBe(1);
    expect(sessionsForPages(0, 40)).toBe(0);
    expect(sessionsForPages(281, 40)).toBe(8);
  });

  it('respektuje jinou kapacitu z Ceníků', () => {
    expect(sessionsForPages(100, 50)).toBe(2);
    expect(sessionsForPages(100, 25)).toBe(4);
    expect(sessionsForPages(100, 0)).toBe(0);
  });
});

describe('kolize', () => {
  it('dotyk hranou není kolize — 9–13 a 13–17 na sebe navazují', () => {
    expect(overlaps(brno(14, 540), brno(14, 780), brno(14, 780), brno(14, 1020))).toBe(false);
  });

  it('překryv o minutu kolize je', () => {
    expect(overlaps(brno(14, 540), brno(14, 781), brno(14, 780), brno(14, 1020))).toBe(true);
  });

  it('obsazené studio hlásí kolizi', () => {
    const kolize = findCollisions(
      { start: brno(14, 540), end: brno(14, 780) },
      {
        studioSlots: [
          { id: 's1', start: brno(14, 600), end: brno(14, 840), label: 'Tři mušketýři · Novák' },
        ],
      },
    );
    expect(kolize).toHaveLength(1);
    expect(kolize[0].kind).toBe('STUDIO');
    expect(kolize[0].withId).toBe('s1');
  });

  it('herec nesmí mít dvě natáčení naráz, i když je jiné studio', () => {
    const kolize = findCollisions(
      { start: brno(14, 540), end: brno(14, 780) },
      { actorSlots: [{ id: 'a1', start: brno(14, 540), end: brno(14, 780), label: 'Rebelka' }] },
    );
    expect(kolize.map((k) => k.kind)).toEqual(['ACTOR']);
  });

  it('blokace studia termín nepustí', () => {
    const kolize = findCollisions(
      { start: brno(14, 540), end: brno(14, 780) },
      { blocks: [{ id: 'b1', start: brno(14, 0), end: brno(15, 0), title: 'Údržba' }] },
    );
    expect(kolize.map((k) => k.kind)).toEqual(['BLOCK']);
  });

  it('volný termín projde bez kolizí', () => {
    expect(findCollisions({ start: brno(14, 540), end: brno(14, 780) }, {})).toHaveLength(0);
  });
});

describe('pracovní doba', () => {
  it('9–13 v pondělí je v pořádku', () => {
    const v = checkOpeningHours({ start: brno(14, 540), end: brno(14, 780) }, 'Europe/Prague', HODINY);
    expect(v.ok).toBe(true);
    expect(v.byArrangement).toBe(false);
  });

  it('sobota projde, ale jen po domluvě', () => {
    const v = checkOpeningHours({ start: brno(12, 540), end: brno(12, 780) }, 'Europe/Prague', HODINY);
    expect(v.ok).toBe(true);
    expect(v.byArrangement).toBe(true);
    expect(v.message).toMatch(/domluvě/);
  });

  it('termín od 7:00 je mimo pracovní dobu', () => {
    const v = checkOpeningHours({ start: brno(14, 420), end: brno(14, 660) }, 'Europe/Prague', HODINY);
    expect(v.ok).toBe(false);
  });
});

describe('časová pásma', () => {
  it('9:00 v Brně je v létě 7:00 UTC', () => {
    expect(brno(14, 540).toISOString()).toBe('2026-09-14T07:00:00.000Z');
  });

  it('9:00 v Londýně je 8:00 UTC', () => {
    expect(zonedToUtc(2026, 9, 14, 540, 'Europe/London').toISOString()).toBe('2026-09-14T08:00:00.000Z');
  });

  it('přežije změnu času — 9:00 v Brně po konci letního času je 8:00 UTC', () => {
    expect(zonedToUtc(2026, 11, 2, 540, 'Europe/Prague').toISOString()).toBe('2026-11-02T08:00:00.000Z');
  });

  it('zpětný převod sedí', () => {
    expect(minutesInZone(brno(14, 540), 'Europe/Prague')).toBe(540);
    expect(weekdayInZone(brno(12, 540), 'Europe/Prague')).toBe(6); // sobota
    expect(weekdayInZone(brno(14, 540), 'Europe/Prague')).toBe(1); // pondeli
  });
});

describe('stavový automat', () => {
  it('schválení a potvrzení je jeden krok', () => {
    expect(canTransition('SUBMITTED', 'CONFIRMED')).toBe(true);
    expect(ALLOWED_TRANSITIONS.SUBMITTED).toContain('RETURNED');
  });

  it('z konceptu se rovnou nepotvrzuje', () => {
    expect(canTransition('DRAFT', 'CONFIRMED')).toBe(false);
  });

  it('zrušené a dokončené jsou koncové stavy', () => {
    expect(ALLOWED_TRANSITIONS.CANCELLED).toHaveLength(0);
    expect(ALLOWED_TRANSITIONS.COMPLETED).toHaveLength(0);
  });

  it('zrušit jde odkudkoliv, dokud to není konečné', () => {
    for (const stav of ['DRAFT', 'PREPARING', 'SENT', 'PICKING', 'SUBMITTED', 'CONFIRMED']) {
      expect(canTransition(stav, 'CANCELLED')).toBe(true);
    }
  });
});

describe('výběr termínů hercem', () => {
  it('počítá, kolik ještě zbývá', () => {
    expect(remainingToPick(3, 0)).toBe(3);
    expect(remainingToPick(3, 2)).toBe(1);
    expect(remainingToPick(3, 3)).toBe(0);
  });

  it('při přebytku nejde do záporu', () => {
    expect(remainingToPick(3, 5)).toBe(0);
  });
});

/** Papíry na stole (21. 9. 2026): žádný název nesmí být zakrytý. */
import { rozvrhniPrekryvy as rozvrhPapiry, HLAVICKA_PX, HOUR_PX as HODINA } from '../src/lib/calendar';
describe('rozvrhniPrekryvy – papíry na stole', () => {
  const m = (h: string) => {
    const [a, b] = h.split(':').map(Number);
    return a * 60 + b;
  };
  // Pondělí 21. 9. 2026 ze screenshotu - tři studia, střihy přes celý den.
  const den = [
    { id: 'A', od: m('6:00'), do: m('14:00') },
    { id: 'B', od: m('9:00'), do: m('17:00') },
    { id: 'C', od: m('9:00'), do: m('13:00') },
    { id: 'D', od: m('10:00'), do: m('14:00') },
    { id: 'E', od: m('12:00'), do: m('15:00') },
    { id: 'F', od: m('13:00'), do: m('17:00') },
    { id: 'G', od: m('14:00'), do: m('14:15') },
    { id: 'H', od: m('14:00'), do: m('16:00') },
    { id: 'I', od: m('14:30'), do: m('15:30') },
  ];
  const r = rozvrhPapiry(den);

  it('naráz začínající leží vedle sebe', () => {
    expect(r.get('B')!.posun + r.get('B')!.podil).toBeLessThanOrEqual(r.get('C')!.posun + 1e-9);
  });

  it('pozdější papír pod názvy ostatních dostane skoro celou šířku', () => {
    for (const id of ['D', 'E', 'F']) expect(r.get(id)!.podil).toBeGreaterThan(0.8);
  });

  it('žádná hlavička není zakrytá papírem, který leží výš', () => {
    const hlavickaMin = (HLAVICKA_PX * 60) / HODINA;
    for (const p of den) {
      for (const q of den) {
        if (p === q) continue;
        const rp = r.get(p.id)!;
        const rq = r.get(q.id)!;
        if (rq.vrstva <= rp.vrstva) continue;
        const svisle = q.od < Math.min(p.od + hlavickaMin, Math.max(p.do, p.od + (16 * 60) / HODINA)) && q.od >= p.od;
        const vodorovne = rq.posun < rp.posun + rp.podil - 1e-9 && rp.posun < rq.posun + rq.podil - 1e-9;
        expect(svisle && vodorovne, `${q.id} zakrývá název ${p.id}`).toBe(false);
      }
    }
  });
});

/** Střih kabinu nedrží (20. 9. 2026). */
import { zabiraStudio } from '../src/lib/calendar';
describe('zabiraStudio', () => {
  it('jen střih se smí překrývat', () => {
    expect(zabiraStudio('STRIH')).toBe(false);
    expect(zabiraStudio('NATACENI')).toBe(true);
    expect(zabiraStudio('CASTING')).toBe(true);
    expect(zabiraStudio('MAINTENANCE')).toBe(true);
  });
});
