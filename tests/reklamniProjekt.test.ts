import { describe, expect, it } from 'vitest';
import {
  STAVY_JEN_PRO_AUDIOKNIHU,
  jeReklamniProjekt,
  jeStavJenProAudioknihu,
} from '../src/lib/reklamniProjekt';
import { stavyProFirmu } from '../src/lib/stavyProjektu';

/**
 * Zadání 30. 9. 2026: „u reklam nemáme vůbec vidět stav Čekáme na opravy, ani
 * se to do něj nemá nikdy překlápět. Ani Natáčíme/stříháme, Dotočeno,
 * Dotočeno-stříháme."
 *
 * Jádro je rozpoznat, že projekt JE reklama — dřív to každé místo v portálu
 * počítalo po svém a spot u klienta, který dělá reklamy i audioknihy, prošel
 * jako audiokniha.
 */
const CISELNIK = {
  typAudioknihy: 'Natáčení a postprodukce audioknihy',
  typyRodnehoListu: ['Výroba rádiového spotu'],
};

describe('je projekt reklama', () => {
  it('rádiový spot ano, i u firmy, která dělá audioknihy', () => {
    expect(
      jeReklamniProjekt({
        ...CISELNIK,
        projectType: 'Výroba rádiového spotu',
        firmaDelaReklamy: false,
        firmaDelaAudioknihy: true,
      }),
    ).toBe(true);
  });

  it('firma, která dělá jen reklamy, má reklamu i bez vyplněného typu', () => {
    expect(
      jeReklamniProjekt({
        ...CISELNIK,
        projectType: null,
        firmaDelaReklamy: true,
        firmaDelaAudioknihy: false,
      }),
    ).toBe(true);
  });

  it('u firmy, která dělá obojí, rozhoduje typ zakázky', () => {
    const firma = { firmaDelaReklamy: true, firmaDelaAudioknihy: true };
    // Voiceover není audiokniha - je to reklama, i když nemá Rodný list.
    expect(jeReklamniProjekt({ ...CISELNIK, ...firma, projectType: 'Natáčení voiceoveru' })).toBe(
      true,
    );
    expect(
      jeReklamniProjekt({ ...CISELNIK, ...firma, projectType: CISELNIK.typAudioknihy }),
    ).toBe(false);
  });

  it('projekt bez typu u firmy, která dělá obojí, zůstává audioknihou', () => {
    expect(
      jeReklamniProjekt({
        ...CISELNIK,
        projectType: null,
        firmaDelaReklamy: true,
        firmaDelaAudioknihy: true,
      }),
    ).toBe(false);
  });

  it('projekt bez firmy a bez typu není reklama', () => {
    expect(
      jeReklamniProjekt({
        ...CISELNIK,
        projectType: null,
        firmaDelaReklamy: false,
        firmaDelaAudioknihy: false,
      }),
    ).toBe(false);
  });
});

describe('stavy u reklamy', () => {
  it('nabídka u reklamy neobsahuje ani jeden audioknižní stav', () => {
    const nabizene = stavyProFirmu(true).map((s) => s.nazev);
    for (const stav of STAVY_JEN_PRO_AUDIOKNIHU) {
      expect(nabizene).not.toContain(stav);
    }
  });

  it('u audioknihy se nabízí všechno', () => {
    const nabizene = stavyProFirmu(false).map((s) => s.nazev);
    for (const stav of STAVY_JEN_PRO_AUDIOKNIHU) {
      expect(nabizene).toContain(stav);
    }
  });

  it('stav, který projekt už má, se nabídne i u reklamy - jinak by se nedal přepnout', () => {
    const nabizene = stavyProFirmu(true, 'Čekáme na opravy').map((s) => s.nazev);
    expect(nabizene).toContain('Čekáme na opravy');
  });

  it('jeStavJenProAudioknihu pozná i stav s mezerami okolo', () => {
    expect(jeStavJenProAudioknihu(' Dotočeno ')).toBe(true);
    expect(jeStavJenProAudioknihu('Natáčíme')).toBe(false);
    expect(jeStavJenProAudioknihu(null)).toBe(false);
  });
});
