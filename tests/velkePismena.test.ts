import { describe, expect, it } from 'vitest';
import { naVelke, zacatekVety } from '../src/lib/velkePismena';

describe('zacatekVety', () => {
  it('začátek zprávy', () => {
    expect(zacatekVety('')).toBe(true);
    expect(zacatekVety('   ')).toBe(true);
  });

  it('nová řádka', () => {
    expect(zacatekVety('ahoj\n')).toBe(true);
    expect(zacatekVety('ahoj\n  ')).toBe(true);
  });

  it('po tečce, vykřičníku a otazníku', () => {
    expect(zacatekVety('Hotovo. ')).toBe(true);
    expect(zacatekVety('Hotovo! ')).toBe(true);
    expect(zacatekVety('Fakt? ')).toBe(true);
    expect(zacatekVety('No… ')).toBe(true);
  });

  it('uprostřed slova ani po tečce bez mezery ne', () => {
    expect(zacatekVety('ahoj')).toBe(false);
    expect(zacatekVety('Hotovo.')).toBe(false);
    expect(zacatekVety('www.seznam.')).toBe(false);
    expect(zacatekVety('verze 3.')).toBe(false);
  });

  it('datum a pořadí větu nekončí', () => {
    expect(zacatekVety('natáčíme 16. ')).toBe(false);
    expect(zacatekVety('bod 3. ')).toBe(false);
  });

  it('zkratky větu nekončí', () => {
    expect(zacatekVety('poslal jsem to např. ')).toBe(false);
    expect(zacatekVety('strany atd. ')).toBe(false);
    expect(zacatekVety('Audiotéka s.r.o. ')).toBe(false);
  });
});

describe('naVelke', () => {
  it('zvětší malé písmeno včetně diakritiky', () => {
    expect(naVelke('a')).toBe('A');
    expect(naVelke('š')).toBe('Š');
    expect(naVelke('č')).toBe('Č');
  });

  it('nic jiného nemění', () => {
    expect(naVelke('A')).toBeNull();
    expect(naVelke('1')).toBeNull();
    expect(naVelke(' ')).toBeNull();
    expect(naVelke('ab')).toBeNull();
  });
});
