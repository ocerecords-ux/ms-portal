import { describe, expect, it } from 'vitest';
import {
  STAVY_PROJEKTU,
  STAV_OPRAVUJEME,
  jeStavBezNotifikaci,
  stavJeDokonceny,
  stavJeOdevzdany,
} from '../src/lib/stavyProjektu';
import { ACTIVE_PROJECT_STATUSES } from '../src/lib/projectTypes';

/**
 * Stav „Opravujeme" (zadání 27. 9. 2026). Podstatné je, kde v cestě projektu
 * sedí a že se z něj neposílá.
 */
const nazvy = STAVY_PROJEKTU.map((s) => s.nazev);

describe('Opravujeme', () => {
  it('je v cestě projektu mezi čekáním na opravy a fakturací', () => {
    expect(nazvy.indexOf(STAV_OPRAVUJEME)).toBeGreaterThan(nazvy.indexOf('Čekáme na opravy'));
    expect(nazvy.indexOf(STAV_OPRAVUJEME)).toBeLessThan(nazvy.indexOf('Schváleno - k fakturaci'));
  });

  it('z něj neodchází klientovi nic', () => {
    expect(jeStavBezNotifikaci(STAV_OPRAVUJEME)).toBe(true);
    expect(jeStavBezNotifikaci('Dokončeno - ke schválení')).toBe(false);
    expect(jeStavBezNotifikaci(null)).toBe(false);
  });

  it('projekt v něm pořád běží a je odevzdaný', () => {
    expect(stavJeDokonceny(STAV_OPRAVUJEME)).toBe(false);
    expect(stavJeOdevzdany(STAV_OPRAVUJEME)).toBe(true);
    expect(ACTIVE_PROJECT_STATUSES).toContain(STAV_OPRAVUJEME);
  });

  it('poslední dva stavy cesty zůstaly fakturační', () => {
    // Ukončení projektu se o ně opírá indexem - kdyby se nový stav přidal na
    // konec, zavíralo by se něco jiného.
    expect(nazvy[nazvy.length - 1]).toBe('Vyfakturováno');
    expect(nazvy[nazvy.length - 2]).toBe('Schváleno - k fakturaci');
  });
});
