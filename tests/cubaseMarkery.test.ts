import { describe, expect, it } from 'vitest';
import { TIKU_ZA_VTERINU, bezDiakritiky, souborMarkeru } from '../src/lib/cubaseMarkery';

/** Přečte markery zpátky ze souboru - ať se ověří to, co Cubase opravdu uvidí. */
function precti(data: Uint8Array): { tik: number; text: string }[] {
  const b = Buffer.from(data);
  expect(b.slice(0, 4).toString('ascii')).toBe('MThd');
  expect(b.readUInt16BE(8)).toBe(0); // format 0
  expect(b.slice(14, 18).toString('ascii')).toBe('MTrk');
  expect(b.readUInt32BE(18)).toBe(b.length - 22); // sedi delka stopy

  const markery: { tik: number; text: string }[] = [];
  let i = 22;
  let tik = 0;
  const vlq = () => {
    let v = 0;
    for (;;) {
      const c = b[i];
      i += 1;
      v = (v << 7) | (c & 0x7f);
      if (!(c & 0x80)) break;
    }
    return v;
  };
  while (i < b.length) {
    tik += vlq();
    expect(b[i]).toBe(0xff);
    const typ = b[i + 1];
    i += 2;
    const delka = vlq();
    const obsah = b.slice(i, i + delka);
    i += delka;
    if (typ === 0x06) markery.push({ tik, text: obsah.toString('latin1') });
  }
  return markery;
}

describe('markery do Cubase', () => {
  it('vyrobí platný MIDI soubor se značkami na správných ticích', () => {
    const markery = precti(
      souborMarkeru([
        { cas: 0, nazev: '01 00:03.5 preřek' },
        { cas: 65.25, nazev: '01 01:05.2 nádech' },
        { cas: 3612.5, nazev: '02 00:12.5 šum' },
      ]),
    );
    expect(markery).toHaveLength(3);
    expect(markery[0].tik).toBe(0);
    expect(markery[1].tik).toBe(Math.round(65.25 * TIKU_ZA_VTERINU));
    expect(markery[2].tik).toBe(Math.round(3612.5 * TIKU_ZA_VTERINU));
  });

  it('seřadí markery podle času, i když přijdou zpřeházené', () => {
    const markery = precti(
      souborMarkeru([
        { cas: 100, nazev: 'druhy' },
        { cas: 10, nazev: 'prvni' },
      ]),
    );
    expect(markery.map((m) => m.text)).toEqual(['prvni', 'druhy']);
  });

  it('vyhodí diakritiku, ať se název v DAW nerozsype', () => {
    expect(bezDiakritiky('přeřek šumí')).toBe('prerek sumi');
    expect(bezDiakritiky('   ')).toBe('');
  });

  it('marker bez názvu do souboru nepatří', () => {
    expect(precti(souborMarkeru([{ cas: 5, nazev: '   ' }]))).toHaveLength(0);
  });
});
