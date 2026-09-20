import { describe, expect, it } from 'vitest';
import { prahaNaUtc, rozeberUdalost } from '../src/lib/importGoogleKalendar';

/** Převod starého Google kalendáře (zadání 20. 9. 2026). */
describe('rozeberUdalost', () => {
  it('natáčení: herec – projekt (zvukař)', () => {
    expect(rozeberUdalost('Jiří Miroslav Valůšek – Vlakař (TI)')).toMatchObject({
      druh: 'NATACENI',
      herec: 'Jiří Miroslav Valůšek',
      projekt: 'Vlakař',
      zvukar: 'Tomáš Ilavský',
    });
  });
  it('krátká pomlčka a značka ☎', () => {
    expect(rozeberUdalost('☎ Petr Štěpán - Krvavý cejch (R)')).toMatchObject({
      herec: 'Petr Štěpán',
      projekt: 'Krvavý cejch',
      zvukar: 'Richard Hanula',
      znacky: ['☎'],
    });
  });
  it('střih s projektem i bez', () => {
    expect(rozeberUdalost('Strih (TM) -Nástroje pro život')).toMatchObject({ druh: 'STRIH', projekt: 'Nástroje pro život', zvukar: 'Tomáš Moravec' });
    expect(rozeberUdalost('Střih (TI)')).toMatchObject({ druh: 'STRIH', projekt: 'Střih', zvukarZkratka: 'TI' });
  });
  it('bez zvukaře', () => {
    expect(rozeberUdalost('Tomáš Žilinský – Kousek tebe')).toMatchObject({ herec: 'Tomáš Žilinský', zvukar: null });
  });
});

describe('prahaNaUtc', () => {
  it('letní i zimní čas', () => {
    expect(prahaNaUtc('2026-09-14', '09:00').toISOString()).toBe('2026-09-14T07:00:00.000Z');
    expect(prahaNaUtc('2026-12-01', '09:00').toISOString()).toBe('2026-12-01T08:00:00.000Z');
  });
});
