import { describe, expect, it } from 'vitest';
import { hodiny, procenta } from '../src/lib/kapacitaServer';

/** Kapacita studií (zadání 20. 9. 2026). */
describe('kapacita studií', () => {
  it('procenta z minut', () => {
    expect(procenta({ kapacitaMinut: 600, natoceno: 300 })).toBe(50);
    expect(procenta({ kapacitaMinut: 0, natoceno: 0 })).toBeNull();
    // Natáčení o víkendu, kdy studio kapacitu nemá - ukáže se jako plno.
    expect(procenta({ kapacitaMinut: 0, natoceno: 120 })).toBe(100);
  });
  it('hodiny bez zbytečných desetin', () => {
    expect(hodiny(240)).toBe('4');
    expect(hodiny(270)).toBe('4,5');
  });
});
