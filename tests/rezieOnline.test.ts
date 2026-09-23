import { describe, expect, it } from 'vitest';
import { klicRezie } from '../src/lib/rezieOnline';

/**
 * Klíč dvojice projekt + herec (zadání 23. 9. 2026) - podle něj se pozná,
 * která frekvence je ta první, a tedy kde svítí ikona režie.
 */
describe('klicRezie', () => {
  it('bere účet herce, když ho má', () => {
    expect(klicRezie('123', 'u1', 'Jan Novák')).toBe('123|u:u1');
  });

  it('bez účtu se herec pozná podle jména - bez diakritiky a velikosti písmen', () => {
    expect(klicRezie('123', null, 'Jan Novák')).toBe(klicRezie('123', null, 'jan  novak'));
  });

  it('dva herci na stejné knize mají každý svůj klíč', () => {
    expect(klicRezie('123', 'u1', null)).not.toBe(klicRezie('123', 'u2', null));
  });

  it('stejný herec na jiné knize má jiný klíč', () => {
    expect(klicRezie('123', 'u1', null)).not.toBe(klicRezie('456', 'u1', null));
  });

  it('bez projektu nebo bez herce klíč není - taková událost ikonu nedostane', () => {
    expect(klicRezie('', 'u1', 'Jan')).toBeNull();
    expect(klicRezie('123', null, '   ')).toBeNull();
  });
});
