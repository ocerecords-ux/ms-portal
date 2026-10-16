import { describe, expect, it } from 'vitest';
import { bezTitulu } from '../src/lib/jmena';

/**
 * JMÉNO BEZ TITULŮ (15. 9. 2026: „u těch herců všude v portálu nezobrazovat
 * tituly před a za jménem", 16. 10. 2026: „v těch bublinách u herců by neměly
 * svítit tituly").
 *
 * Testuje se to, co se dá snadno rozbít: titul přilepený k jménu bez mezery
 * a opačný extrém - jméno, které jako titul jen vypadá. Přepsat člověku
 * jméno je horší než nechat u něj svítit „MgA.".
 */

describe('bezTitulu', () => {
  it('odebere titul před jménem', () => {
    expect(bezTitulu('Mgr. Jan Novák')).toBe('Jan Novák');
    expect(bezTitulu('doc. Ing. Jan Novák')).toBe('Jan Novák');
  });

  it('odebere titul za jménem', () => {
    expect(bezTitulu('Jan Novák, Ph.D.')).toBe('Jan Novák');
    expect(bezTitulu('Jan Novák DiS.')).toBe('Jan Novák');
  });

  it('odebere i titul přilepený k jménu bez mezery', () => {
    // Takhle to měl zapsané Robert Jícha a v bublině mu titul svítil dál.
    expect(bezTitulu('MgA.Robert Jícha')).toBe('Robert Jícha');
    expect(bezTitulu('Ing.Petr Malý, MBA')).toBe('Petr Malý');
  });

  it('jméno bez titulu nechá přesně tak, jak je', () => {
    expect(bezTitulu('Karolína Půčková')).toBe('Karolína Půčková');
    // Rozdělování za tečkou je jen pomůcka pro hledání titulů - iniciály
    // se kvůli němu nesmí rozestoupit.
    expect(bezTitulu('J.K. Rowling')).toBe('J.K. Rowling');
    expect(bezTitulu('Ondřej Novák - Brno')).toBe('Ondřej Novák - Brno');
  });

  it('ze samých titulů radši vrátí původní zápis', () => {
    expect(bezTitulu('Mgr.')).toBe('Mgr.');
    expect(bezTitulu('')).toBe('');
    expect(bezTitulu(null)).toBe('');
  });
});
