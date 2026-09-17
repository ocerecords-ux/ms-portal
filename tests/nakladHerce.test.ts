import { describe, expect, it } from 'vitest';
import { najdiNakladHerce } from '../src/lib/nakladHerce';

/** Zkratka na položky rozpočtu - v testu je čitelnější než pole objektů. */
const N = (...polozky: [string, number][]) => polozky.map(([nazev, castka]) => ({ nazev, castka }));

describe('najdiNakladHerce', () => {
  it('najde položku podle celého jména', () => {
    expect(najdiNakladHerce(N(['Herec - Jan Novák', 5000], ['Studio', 3000]), 'Jan Novák')).toBe(0);
  });

  it('najde položku podle příjmení', () => {
    expect(najdiNakladHerce(N(['Studio', 3000], ['Novák honorář', 5000]), 'Jan Novák')).toBe(1);
  });

  it('nezáleží na diakritice', () => {
    expect(najdiNakladHerce(N(['Cerny honorar', 5000]), 'Ondřej Černý')).toBe(0);
  });

  it('u jediného herce vezme i položku „Herec"', () => {
    expect(najdiNakladHerce(N(['Herec', 5000], ['Studio', 3000]), 'Jan Novák', 1)).toBe(0);
  });

  it('u dvojhlasu se podle slova „herec" netrefuje', () => {
    expect(najdiNakladHerce(N(['Herec', 5000], ['Herečka', 4000]), 'Jan Novák', 2)).toBeNull();
  });

  it('dvě položky se jménem rozhodne člověk', () => {
    expect(najdiNakladHerce(N(['Herec Novák', 5000], ['Herec Novák II', 4000]), 'Jan Novák')).toBeNull();
  });

  it('když nic nesedí, vrací null', () => {
    expect(najdiNakladHerce(N(['Studio', 3000]), 'Jan Novák')).toBeNull();
    expect(najdiNakladHerce(N(), 'Jan Novák')).toBeNull();
    expect(najdiNakladHerce(N(['Honorář herce', 5000]), '')).toBeNull();
  });
});
