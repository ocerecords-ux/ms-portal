import { describe, expect, it } from 'vitest';
import { najdiMezery, vypisCisla, jeNaCoUpozornit } from '../src/lib/mezeryVeStopach';

/**
 * Díry v číslování stop (zadání 19. 11. 2026 po mailu z Audioteky
 * „mrkněte prosím na chybějící tracky 17 - 20").
 */
const stopa = (poradi: number | null, name = `${String(poradi ?? 0).padStart(2, '0')}_kapitola.wav`) => ({
  name,
  poradi,
});

describe('najdiMezery', () => {
  it('souvislá řada je v pořádku', () => {
    const m = najdiMezery([1, 2, 3, 4, 5].map((c) => stopa(c)));
    expect(m.chybi).toEqual([]);
    expect(jeNaCoUpozornit(m)).toBe(false);
  });

  it('najde díru uprostřed', () => {
    const m = najdiMezery([1, 2, 4, 5].map((c) => stopa(c)));
    expect(m.chybi).toEqual([3]);
  });

  it('chybějící konec pozná jen podle tracklistu', () => {
    const naDisku = [...Array(16)].map((_, i) => stopa(i + 1));
    expect(najdiMezery(naDisku).chybi).toEqual([]);
    expect(najdiMezery(naDisku, 20).chybi).toEqual([17, 18, 19, 20]);
  });

  it('chybějící začátek, když je náskok malý', () => {
    expect(najdiMezery([3, 4, 5].map((c) => stopa(c))).chybi).toEqual([1, 2]);
  });

  it('číslování od sta není díra po sto stopách', () => {
    expect(najdiMezery([101, 102, 103].map((c) => stopa(c))).chybi).toEqual([]);
  });

  it('dvě stopy se stejným číslem jsou taky nález', () => {
    const m = najdiMezery([stopa(1), stopa(2, '02_kapitola.wav'), stopa(2, '02_kapitola_oprava.wav'), stopa(3)]);
    expect(m.duplicity).toEqual([2]);
    expect(jeNaCoUpozornit(m)).toBe(true);
  });

  it('pod třemi stopami se nesoudí', () => {
    expect(najdiMezery([stopa(1), stopa(5)]).chybi).toEqual([]);
  });

  it('soubory bez čísla se jen vypíšou, poplach to není', () => {
    const m = najdiMezery([stopa(1), stopa(2), stopa(3), stopa(null, 'mix_final.wav')]);
    expect(m.bezCisla).toEqual(['mix_final.wav']);
    expect(jeNaCoUpozornit(m)).toBe(false);
  });
});

describe('vypisCisla', () => {
  it('souvislý úsek spojí pomlčkou', () => {
    expect(vypisCisla([17, 18, 19, 20])).toBe('17-20');
  });

  it('dvojici radši vyjmenuje', () => {
    expect(vypisCisla([7, 8])).toBe('7, 8');
  });

  it('roztroušená čísla spojí spojkou', () => {
    expect(vypisCisla([3, 17, 19])).toBe('3, 17 a 19');
  });

  it('úseky i jednotlivá čísla dohromady', () => {
    expect(vypisCisla([2, 3, 4, 9])).toBe('2-4 a 9');
  });
});
