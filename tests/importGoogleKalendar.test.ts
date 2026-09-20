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

/** Praha (20. 9. 2026): zvukař křestním jménem, casting, úklid, porada, _CUT. */
describe('rozeberUdalost – Praha', () => {
  it('zvukař jménem a pracovní verze _CUT', () => {
    expect(rozeberUdalost('✈️ Strih (Matej) Vlakař_CUT')).toMatchObject({ druh: 'STRIH', projekt: 'Vlakař', zvukarZkratka: 'Matej', znacky: ['✈️', 'CUT'] });
  });
  it('casting s hercem', () => {
    expect(rozeberUdalost('☎ CASTING Nicole Tisotová (O)')).toMatchObject({ druh: 'CASTING', herec: 'Nicole Tisotová', zvukarZkratka: 'O' });
  });
  it('dlouhá pomlčka bez mezery před ní', () => {
    expect(rozeberUdalost('Robin Ferro– Tajná mise Salamandr')).toMatchObject({ herec: 'Robin Ferro', projekt: 'Tajná mise Salamandr' });
  });
  it('úklid a porada nejsou natáčení', () => {
    expect(rozeberUdalost('Úklid studia').druh).toBe('MAINTENANCE');
    expect(rozeberUdalost('TECHNICKÁ PORADA O+P+T+M').druh).toBe('INTERNAL');
  });
});

/** Casting jako samostatný druh práce (20. 9. 2026). */
describe('rozeberUdalost – casting', () => {
  it('CASTING jméno i jméno – CASTING', () => {
    expect(rozeberUdalost('☎ CASTING Nicole Tisotová (O)')).toMatchObject({ druh: 'CASTING', herec: 'Nicole Tisotová', projekt: '' });
    expect(rozeberUdalost('☎ Míma Krajčová – CASTING')).toMatchObject({ druh: 'CASTING', herec: 'Míma Krajčová' });
  });
});
