import { describe, expect, it } from 'vitest';
import { docxNataceciTextu, rozmeryPng } from '../src/lib/nataceniTextDocx';
import { textZDocx } from '../src/lib/docxText';
import { zabalZip } from '../src/lib/zipZapis';

/**
 * Natáčecí list jako .docx (zadání 30. 9. 2026). Test jde tam a zpátky: co
 * zapisovač ZIPu složí, to čtečka .docx z docxText.ts zase rozebere. Kdyby se
 * v hlavičkách ZIPu cokoliv rozešlo, soubor by se otevřít nedal a tohle to
 * chytí dřív než Disk.
 */
const VZOR = {
  uvod: 'Natáčecí list k projektu {{projekt}} pro klienta {{klient}}.',
  blok: '{{spot}}\n{{delka}} · {{licence}}\n\n[text spotu]',
};

const PODKLADY = {
  projekt: 'SVEN CAR - VOLVO EX60',
  klient: 'Eva Loskotová',
  upraveno: '30. 9. 2026',
  logoUrl: null,
};

const VYSTUPY = [
  {
    nazev: 'SVEN CAR - VOLVO EX60 - 20s_rádio',
    delka: '20s',
    licence: 'Rádio',
    text: 'Zažijte taky – CO dokáže.\n   680 koní, 810 kilometrů na jedno nabití.',
  },
  { nazev: 'SVEN CAR - VOLVO EX60 - 30s_online', delka: '30s', licence: 'Online', text: '' },
];

describe('zapisovač ZIPu', () => {
  it('složí archiv, ze kterého jde soubor zase přečíst', () => {
    const docx = docxNataceciTextu(VZOR, PODKLADY, VYSTUPY, null);
    expect(docx.length).toBeGreaterThan(500);
    // Podpis lokální hlavičky - bez něj to ZIP není.
    expect(docx.readUInt32LE(0)).toBe(0x04034b50);
    expect(textZDocx(docx)).not.toBeNull();
  });

  it('umí i uložení bez komprese', () => {
    const archiv = zabalZip([
      { nazev: 'a.txt', data: Buffer.from('ahoj', 'utf-8'), bezKomprese: true },
      { nazev: 'b/c.txt', data: Buffer.from('druhý soubor', 'utf-8') },
    ]);
    expect(archiv.readUInt32LE(0)).toBe(0x04034b50);
    expect(archiv.length).toBeGreaterThan(50);
  });
});

describe('natáčecí list v .docx', () => {
  const text = textZDocx(docxNataceciTextu(VZOR, PODKLADY, VYSTUPY, null)) ?? '';

  it('má hlavičku s projektem i klientem', () => {
    expect(text).toContain('NATÁČECÍ LIST');
    expect(text).toContain('SVEN CAR - VOLVO EX60');
    expect(text).toContain('Eva Loskotová');
    expect(text).toContain('Poslední úprava: 30. 9. 2026');
  });

  it('má úvod ze vzoru s dosazenými proměnnými', () => {
    expect(text).toContain('Natáčecí list k projektu SVEN CAR - VOLVO EX60 pro klienta Eva Loskotová.');
  });

  it('má každý spot i s délkou a licencí', () => {
    expect(text).toContain('SVEN CAR - VOLVO EX60 - 20s_rádio');
    expect(text).toContain('20s · Rádio');
    expect(text).toContain('SVEN CAR - VOLVO EX60 - 30s_online');
  });

  it('drží text spotu i s odsazením řádku', () => {
    expect(text).toContain('Zažijte taky – CO dokáže.');
    expect(text).toContain('   680 koní');
  });

  it('u spotu bez textu nechá místo na text', () => {
    expect(text).toContain('[text spotu]');
  });

  it('má patičku se značkou', () => {
    expect(text).toContain('Mediaspace');
  });
});

describe('rozměry PNG', () => {
  it('přečte šířku a výšku z hlavičky', () => {
    // Nejmenší platné PNG: podpis + IHDR se šířkou 3 a výškou 7.
    const png = Buffer.alloc(24);
    png.writeUInt32BE(0x89504e47, 0);
    png.writeUInt32BE(0x0d0a1a0a, 4);
    png.writeUInt32BE(13, 8);
    png.write('IHDR', 12, 'ascii');
    png.writeUInt32BE(3, 16);
    png.writeUInt32BE(7, 20);
    expect(rozmeryPng(png)).toEqual({ sirkaPx: 3, vyskaPx: 7 });
  });

  it('u něčeho, co PNG není, vrátí null', () => {
    expect(rozmeryPng(Buffer.from('tohle fakt neni obrazek', 'utf-8'))).toBeNull();
  });
});
