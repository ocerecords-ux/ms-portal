import { describe, expect, it } from 'vitest';
import { dnuDoTerminu, odznakTerminu, stavTerminu } from '../src/lib/terminProjektu';

const DNES = '2026-09-18';

describe('termín dokončení', () => {
  it('počítá kalendářní dny, ne hodiny', () => {
    expect(dnuDoTerminu('2026-09-25', DNES)).toBe(7);
    expect(dnuDoTerminu('2026-09-21', DNES)).toBe(3);
    expect(dnuDoTerminu('2026-09-18', DNES)).toBe(0);
    expect(dnuDoTerminu('2026-09-16', DNES)).toBe(-2);
    expect(dnuDoTerminu(null, DNES)).toBeNull();
  });

  it('přeleze přes konec měsíce', () => {
    expect(dnuDoTerminu(new Date(2026, 9, 1), '2026-09-28')).toBe(3);
  });

  it('rozdělí stavy podle zadání', () => {
    expect(stavTerminu(7)).toBe('daleko');
    expect(stavTerminu(4)).toBe('daleko');
    expect(stavTerminu(3)).toBe('blizko');
    expect(stavTerminu(1)).toBe('blizko');
    expect(stavTerminu(0)).toBe('dnes');
    expect(stavTerminu(-1)).toBe('po');
  });

  it('po termínu odpočítává do mínusu', () => {
    expect(odznakTerminu(3)).toBe('3 dny');
    expect(odznakTerminu(1)).toBe('1 den');
    expect(odznakTerminu(0)).toBe('dnes');
    expect(odznakTerminu(-1)).toBe('−1 den');
    expect(odznakTerminu(-5)).toBe('−5 dní');
    expect(odznakTerminu(9)).toBeNull();
  });
});
