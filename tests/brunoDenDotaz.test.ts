import { describe, expect, it } from 'vitest';
import { denZDotazu } from '../src/lib/brunoDenDotaz';

/** Čtvrtek 24. 9. 2026, deset dopoledne v Praze. */
const CTVRTEK = new Date('2026-09-24T08:00:00.000Z');
const den = (d: Date | null) =>
  d ? new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Prague' }).format(d) : null;

describe('denZDotazu', () => {
  it('„co mám dneska" je dnešek', () => {
    expect(den(denZDotazu('Bruno, co mám dneska?', CTVRTEK))).toBe('2026-09-24');
  });

  it('„co mě čeká zítra" je zítřek', () => {
    expect(den(denZDotazu('Bruno, co mě čeká zítra?', CTVRTEK))).toBe('2026-09-25');
  });

  it('den v týdnu se bere nejbližší dopředu', () => {
    expect(den(denZDotazu('Bruno, co mám v pondělí?', CTVRTEK))).toBe('2026-09-28');
  });

  it('datum ve větě rozhoduje', () => {
    expect(den(denZDotazu('Bruno, co mám 30. 9.?', CTVRTEK))).toBe('2026-09-30');
  });

  it('otázka bez dne je dnešek', () => {
    expect(den(denZDotazu('Bruno, co mám?', CTVRTEK))).toBe('2026-09-24');
  });

  it('věta, která se na program neptá, den nedává', () => {
    expect(denZDotazu('Bruno, zítra dotočíme s Petrem.', CTVRTEK)).toBeNull();
    expect(denZDotazu('33', CTVRTEK)).toBeNull();
  });
});

describe('denZDotazu - přeházená slova (oprava 23. 9. 2026)', () => {
  it('„co mě zítra čeká" je zítřek', () => {
    expect(den(denZDotazu('Co mě zítra čeká?', CTVRTEK))).toBe('2026-09-25');
  });

  it('„co mám v pátek za program" je pátek', () => {
    expect(den(denZDotazu('Bruno, co mám v pátek za program?', CTVRTEK))).toBe('2026-09-25');
  });

  it('otázka na portál není otázka na den', () => {
    expect(denZDotazu('Kde najdu kalendář?', CTVRTEK)).toBeNull();
    expect(denZDotazu('Co je s tím projektem?', CTVRTEK)).toBeNull();
  });

  it('„co tam dneska máme" je dnešek', () => {
    expect(den(denZDotazu('Co tam dneska máme?', CTVRTEK))).toBe('2026-09-24');
  });

  it('věta o práci pořád dotaz na program není', () => {
    expect(denZDotazu('Zítra dotočíme s Petrem.', CTVRTEK)).toBeNull();
    expect(denZDotazu('Poslal jsem ti to včera mailem.', CTVRTEK)).toBeNull();
  });
});
