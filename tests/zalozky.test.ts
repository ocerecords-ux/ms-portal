import { describe, expect, it } from 'vitest';
import { posun, seradZalozky } from '../src/lib/zalozky';

/**
 * VLASTNÍ POŘADÍ ZÁLOŽEK (29. 9. 2026).
 *
 * Hlídá se hlavně to, co se stane, až se seznam záložek v kódu změní: kdo má
 * uložené pořadí z minulého týdne, nesmí přijít o nově přidanou záložku ani
 * skončit s prázdnou lištou, když nějaká zmizí.
 */

describe('seradZalozky', () => {
  const zalozky = [{ klic: 'a' }, { klic: 'b' }, { klic: 'c' }];

  it('bez uloženého pořadí nechá pořadí z kódu', () => {
    expect(seradZalozky(zalozky, []).map((z) => z.klic)).toEqual(['a', 'b', 'c']);
  });

  it('seřadí podle uloženého pořadí', () => {
    expect(seradZalozky(zalozky, ['c', 'a', 'b']).map((z) => z.klic)).toEqual(['c', 'a', 'b']);
  });

  it('záložku, která přibyla po uložení, dá nakonec', () => {
    expect(seradZalozky(zalozky, ['c', 'a']).map((z) => z.klic)).toEqual(['c', 'a', 'b']);
  });

  it('klíč, který už neexistuje, přeskočí', () => {
    expect(seradZalozky(zalozky, ['zrusena', 'c', 'b', 'a']).map((z) => z.klic)).toEqual(['c', 'b', 'a']);
  });
});

describe('posun', () => {
  it('prohodí sousedy', () => {
    expect(posun(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c']);
    expect(posun(['a', 'b', 'c'], 2, 1)).toEqual(['a', 'c', 'b']);
  });

  it('mimo rozsah nechá seznam být - šipka na kraji nesmí nic zahodit', () => {
    expect(posun(['a', 'b', 'c'], 0, -1)).toEqual(['a', 'b', 'c']);
    expect(posun(['a', 'b', 'c'], 2, 3)).toEqual(['a', 'b', 'c']);
  });
});
