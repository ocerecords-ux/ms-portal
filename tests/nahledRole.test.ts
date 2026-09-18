import { describe, expect, it } from 'vitest';
import {
  NAHLED_POHLEDY,
  VYCHOZI_NAHLED,
  nahledZHodnoty,
  pohledNahledu,
} from '../src/lib/nahledRole';

/**
 * Náhledový účet (zadání 18. 9. 2026). Kontroluje se tu jediná věc, na které
 * záleží z pohledu bezpečnosti: cookie si vybírá POUZE ze tří připravených
 * pohledů. Kdyby si ji někdo přepsal na „ADMIN", nesmí se tím nikam dostat.
 */
describe('nahledZHodnoty', () => {
  it('vezme jen připravené pohledy', () => {
    expect(nahledZHodnoty('tym')).toBe('tym');
    expect(nahledZHodnoty('klient')).toBe('klient');
    expect(nahledZHodnoty('herec')).toBe('herec');
  });

  it('cokoliv jiného spadne na výchozí pohled', () => {
    expect(nahledZHodnoty('ADMIN')).toBe(VYCHOZI_NAHLED);
    expect(nahledZHodnoty('admin')).toBe(VYCHOZI_NAHLED);
    expect(nahledZHodnoty('')).toBe(VYCHOZI_NAHLED);
    expect(nahledZHodnoty(null)).toBe(VYCHOZI_NAHLED);
    expect(nahledZHodnoty(undefined)).toBe(VYCHOZI_NAHLED);
  });

  it('mezi půjčenými rolemi není Žůžo-labůžo', () => {
    expect(NAHLED_POHLEDY.map((p) => p.role)).not.toContain('ADMIN');
  });

  it('firmu z účtu bere jen pohled klienta', () => {
    expect(pohledNahledu('klient').sVlastniFirmou).toBe(true);
    expect(pohledNahledu('tym').sVlastniFirmou).toBe(false);
    expect(pohledNahledu('herec').sVlastniFirmou).toBe(false);
  });
});
