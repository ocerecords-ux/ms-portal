import { describe, expect, it } from 'vitest';
import {
  formatProductionDate,
  formatSpotLength,
  isRodnyListTriggerStatus,
  missingRodnyListFields,
  musicLines,
  rodnyListFileName,
  RL_TRIGGER_STATUS,
} from '../src/lib/rodnyList';
import { renderRodnyListPdf, rodnyListRows } from '../src/lib/rodnyListPdf';
// Zalamani a mereni textu se presunulo do spolecneho kreslitka (10. 9. 2026).
import { fitValue, textWidth } from '../src/lib/pdf/kreslitko';
import { FONT_BOLD, FONT_REGULAR } from '../src/lib/rodnyListAssets';

// Testy Rodneho listu (zadani 9. 9. 2026). Bezi bez databaze i bez site -
// logika rozhodovani i samotne vykresleni PDF jsou ciste funkce.

const UPLNA_DATA = {
  clientName: 'BRASED EUROTEXTIL CZ, spol. s.r.o.',
  spotName: 'Dobré podlahy',
  spotLengthSeconds: 20,
  directorName: 'Ondřej Černý',
  musicTitle: 'God Mode',
  musicAuthor: 'Konstantin Garbuzyuk',
  noMusic: false,
  productionDate: new Date('2026-08-24T00:00:00Z'),
};

describe('spousteci stav', () => {
  it('pozna presny nazev stavu', () => {
    expect(isRodnyListTriggerStatus(RL_TRIGGER_STATUS)).toBe(true);
  });

  it('prezije preklepy v diakritice, mezerach i poradove cislo', () => {
    expect(isRodnyListTriggerStatus('Dokonceno - ke schvaleni')).toBe(true);
    expect(isRodnyListTriggerStatus('dokončeno – ke schválení')).toBe(true);
    expect(isRodnyListTriggerStatus('Dokončeno - ke schválení #2')).toBe(true);
  });

  it('jine stavy nespousti nic', () => {
    expect(isRodnyListTriggerStatus('Natáčíme')).toBe(false);
    expect(isRodnyListTriggerStatus('Schváleno - k fakturaci')).toBe(false);
    expect(isRodnyListTriggerStatus('')).toBe(false);
    expect(isRodnyListTriggerStatus(null)).toBe(false);
  });
});

describe('kontrola udaju pred vytvorenim', () => {
  it('u kompletnich dat nechybi nic', () => {
    expect(missingRodnyListFields(UPLNA_DATA)).toEqual([]);
  });

  it('vyjmenuje konkretni chybejici pole', () => {
    const chybi = missingRodnyListFields({
      ...UPLNA_DATA,
      directorName: '   ',
      spotLengthSeconds: null,
      productionDate: null,
    });
    expect(chybi).toContain('Režie');
    expect(chybi).toContain('Délka spotu');
    expect(chybi).toContain('Datum výroby');
    expect(chybi).not.toContain('Název spotu');
  });

  it('bez hudby jsou hudebni pole nepovinna', () => {
    const bezHudby = { ...UPLNA_DATA, musicTitle: '', musicAuthor: '', noMusic: true };
    expect(missingRodnyListFields(bezHudby)).toEqual([]);
  });

  it('s hudbou musi byt vyplneny obe pole', () => {
    const chybi = missingRodnyListFields({ ...UPLNA_DATA, musicAuthor: '' });
    expect(chybi).toEqual(['Autor hudby']);
  });

  it('nulova delka spotu je porad chybejici udaj', () => {
    expect(missingRodnyListFields({ ...UPLNA_DATA, spotLengthSeconds: 0 })).toContain('Délka spotu');
  });
});

describe('formatovani hodnot', () => {
  it('delka spotu odpovida vzoru', () => {
    expect(formatSpotLength(20)).toBe('20s');
    expect(formatSpotLength(null)).toBe('');
    expect(formatSpotLength(0)).toBe('');
  });

  it('datum vyroby je ve tvaru DD.MM.RRRR', () => {
    expect(formatProductionDate(new Date('2026-08-24T00:00:00Z'))).toBe('24.08.2026');
    expect(formatProductionDate(new Date('2026-01-05T00:00:00Z'))).toBe('05.01.2026');
    expect(formatProductionDate(null)).toBe('');
  });

  it('spot bez hudby nesmi mit vymysleny udaj', () => {
    const radky = musicLines({ musicTitle: 'Necekana skladba', musicAuthor: 'Nikdo', noMusic: true });
    expect(radky.title).toBe('Spot bez hudby');
    expect(radky.author).toBe('—');
  });

  it('nazev souboru je bezpecny', () => {
    expect(rodnyListFileName('Dobré podlahy')).toBe('RL_Dobre_podlahy.pdf');
    expect(rodnyListFileName('  Léto/2026: „akce" ')).toBe('RL_Leto_2026_akce.pdf');
    expect(rodnyListFileName('')).toBe('RL_spot.pdf');
    expect(rodnyListFileName('///')).toBe('RL_spot.pdf');
    // Predpona se nikdy nezdvoji, i kdyz ji nazev spotu uz nese (starsi
    // zaznamy z doby, kdy se predvyplnovalo "RL_" + nazev projektu).
    expect(rodnyListFileName('RL_MMB')).toBe('RL_MMB.pdf');
  });
});

describe('sazba dokumentu', () => {
  it('radky jsou v poradi podle vzoru', () => {
    const popisky = rodnyListRows({
      clientName: 'A',
      spotName: 'B',
      spotLength: 'C',
      director: 'D',
      musicTitle: 'E',
      musicAuthor: 'F',
      productionDate: 'G',
    }).map((r) => r.label);
    expect(popisky).toEqual([
      'NÁZEV KLIENTA',
      'NÁZEV SPOTU',
      'DÉLKA',
      'REŽIE',
      'NÁZEV HUDBY',
      'AUTOR HUDBY',
      'DATUM VÝROBY',
    ]);
  });

  it('pisma znaji ceskou diakritiku', () => {
    for (const znak of 'ěščřžýáíéůúďťňĚŠČŘŽÝÁÍÉŮÚ') {
      expect(FONT_REGULAR.glyphs[String(znak.codePointAt(0))]).toBeDefined();
      expect(FONT_BOLD.glyphs[String(znak.codePointAt(0))]).toBeDefined();
    }
  });

  it('kratka hodnota se nezalamuje', () => {
    const vysledek = fitValue(FONT_REGULAR, 'Dobré podlahy', 291, 10);
    expect(vysledek.lines).toEqual(['Dobré podlahy']);
    expect(vysledek.size).toBe(10);
  });

  it('dlouha hodnota se zalomi, misto aby pretekla', () => {
    const dlouhy = 'Nejdelší myslitelný název reklamní agentury a jejího klienta, spol. s r. o.';
    const vysledek = fitValue(FONT_REGULAR, dlouhy, 291, 10);
    expect(vysledek.lines.length).toBeGreaterThan(1);
    expect(vysledek.lines.length).toBeLessThanOrEqual(2);
    for (const radek of vysledek.lines) {
      expect(textWidth(FONT_REGULAR, radek, vysledek.size)).toBeLessThanOrEqual(291);
    }
  });

  it('ani nesmyslne dlouhy vstup nesmi shodit generovani', () => {
    const vysledek = fitValue(FONT_REGULAR, 'A'.repeat(4000), 291, 10);
    expect(textWidth(FONT_REGULAR, vysledek.lines[0], vysledek.size)).toBeLessThanOrEqual(291);
  });
});

describe('vysledne PDF', () => {
  const pdf = renderRodnyListPdf({
    clientName: UPLNA_DATA.clientName,
    spotName: UPLNA_DATA.spotName,
    spotLength: formatSpotLength(UPLNA_DATA.spotLengthSeconds),
    director: UPLNA_DATA.directorName,
    musicTitle: UPLNA_DATA.musicTitle,
    musicAuthor: UPLNA_DATA.musicAuthor,
    productionDate: formatProductionDate(UPLNA_DATA.productionDate),
  });
  const text = pdf.toString('latin1');

  it('je to platne PDF s jednou strankou A4', () => {
    expect(text.startsWith('%PDF-')).toBe(true);
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
    expect(text).toContain('/Count 1');
    expect(text).toContain('/MediaBox [0 0 595.28 841.89]');
  });

  it('obsahuje obe vlozena pisma i oba obrazky', () => {
    expect(text.match(/\/FontFile2/g)?.length).toBe(2);
    expect(text.match(/\/Subtype \/Image/g)?.length).toBe(4); // dva obrazky + jejich masky
    expect(text).toContain('/SMask');
  });

  it('neni prazdne a vejde se do e-mailu i do databaze', () => {
    expect(pdf.length).toBeGreaterThan(20_000);
    expect(pdf.length).toBeLessThan(300_000);
  });
});
