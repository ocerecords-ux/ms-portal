import { describe, expect, it } from 'vitest';
import { ocistiSekce, pocetRadku, radkyZTextu, sekceProProjekt } from '../src/lib/technickeParametry';

/**
 * Technické parametry - co se komu ukáže (zadání 27. 9. 2026).
 *
 * Podstatné je jediné rozhodnutí: u reklamy zvukař nemá vidět řádky, které se
 * jeho projektu netýkají. U audioknihy se naopak neškrtá nic - nakladatelství
 * chce dodržet celou svou sadu.
 */
const REKLAMY = {
  druh: 'REKLAMA' as const,
  sekce: [
    { nadpis: 'Voiceover — nábor', radky: ['wav 32bit mono'], sluzba: 'voiceover' },
    { nadpis: 'Postprodukce', radky: ['wav 32bit stereo', 'TV: wav 24bit'], sluzba: 'postprodukce' },
    { nadpis: 'Rádiový spot', radky: ['mp3 320 kbps'], jenRadio: true },
    { nadpis: 'Platí vždy', radky: ['do složky mixdown'] },
  ],
};

describe('sekceProProjekt', () => {
  it('u reklamy nechá jen objednané služby', () => {
    const vysledek = sekceProProjekt(REKLAMY, { sluzby: ['voiceover'], radiovySpot: false });
    expect(vysledek.map((s) => s.nadpis)).toEqual(['Voiceover — nábor', 'Platí vždy']);
  });

  it('rádiový spot přidá mp3 320', () => {
    const vysledek = sekceProProjekt(REKLAMY, { sluzby: ['postprodukce'], radiovySpot: true });
    expect(vysledek.map((s) => s.nadpis)).toEqual(['Postprodukce', 'Rádiový spot', 'Platí vždy']);
  });

  it('audiokniha se nefiltruje', () => {
    const sada = {
      druh: 'AUDIOKNIHA' as const,
      sekce: [
        { nadpis: 'Natáčení', radky: ['44 kHz / 32bit float'], sluzba: 'voiceover' },
        { nadpis: 'Export', radky: ['mp3 128'] },
      ],
    };
    expect(sekceProProjekt(sada, { sluzby: [], radiovySpot: false })).toHaveLength(2);
  });
});

describe('ocistiSekce', () => {
  it('zahodí prázdné řádky i prázdné sekce', () => {
    const vysledek = ocistiSekce([
      { nadpis: ' Export ', radky: ['mp3 128', '   ', 'stereo'] },
      { nadpis: '', radky: [] },
      'nesmysl',
    ]);
    expect(vysledek).toEqual([{ nadpis: 'Export', radky: ['mp3 128', 'stereo'], sluzba: null, jenRadio: false }]);
  });

  it('z nesmyslu udělá prázdno, ne pád', () => {
    expect(ocistiSekce(null)).toEqual([]);
    expect(ocistiSekce({ a: 1 })).toEqual([]);
  });
});

describe('drobnosti', () => {
  it('radkyZTextu bere každý řádek jako jeden parametr', () => {
    expect(radkyZTextu('mp3 128\n\n  stereo  \n')).toEqual(['mp3 128', 'stereo']);
  });

  it('pocetRadku sčítá napříč sekcemi', () => {
    expect(pocetRadku(REKLAMY.sekce)).toBe(5);
  });
});
