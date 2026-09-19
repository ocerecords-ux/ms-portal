import { deflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { pocetStranPdf } from '../src/lib/pdfStrany';

/** Progres natáčení (19. 9. 2026) stojí na počtu stran PDF s textem. */
describe('pocetStranPdf', () => {
  it('bere Count kořene stromu stránek, ne mezilehlého uzlu', () => {
    const pdf = Buffer.from(
      '%PDF-1.4\n1 0 obj << /Type /Pages /Kids [2 0 R 3 0 R] /Count 120 >> endobj\n' +
        '2 0 obj << /Type /Pages /Parent 1 0 R /Count 60 >> endobj\n%%EOF',
      'latin1',
    );
    expect(pocetStranPdf(pdf)).toBe(120);
  });

  it('najde strom stránek i v komprimovaném object streamu', () => {
    const proud = deflateSync(Buffer.from('<< /Type /Pages /Kids [] /Count 37 >>', 'latin1'));
    const pdf = Buffer.concat([
      Buffer.from('%PDF-1.5\n5 0 obj << /Type /ObjStm /Filter /FlateDecode >>\nstream\n', 'latin1'),
      proud,
      Buffer.from('\nendstream\nendobj\n%%EOF', 'latin1'),
    ]);
    expect(pocetStranPdf(pdf)).toBe(37);
  });

  it('u souboru, který není PDF, nevrací nic', () => {
    expect(pocetStranPdf(Buffer.from('ahoj'))).toBeNull();
  });
});
