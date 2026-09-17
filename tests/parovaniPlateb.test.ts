import { describe, expect, it } from 'vitest';
import { najdiFakturuKPlatbe, vyctiVariabilniSymbol } from '../src/lib/parovaniPlateb';

const faktura = (id: string, vs: string, castka: number, currency = 'CZK') => ({
  id,
  number: vs,
  variableSymbol: vs,
  currency,
  totalIncVatMinor: castka,
});

describe('vyctiVariabilniSymbol', () => {
  it('najde popsaný VS', () => {
    expect(vyctiVariabilniSymbol('Platba VS: 2026041')).toBe('2026041');
    expect(vyctiVariabilniSymbol('v.s. 2026041 faktura')).toBe('2026041');
    expect(vyctiVariabilniSymbol('/VS/2026041/SS/0')).toBe('2026041');
  });

  it('osamocené číslo vezme, dvě čísla ne', () => {
    expect(vyctiVariabilniSymbol('2026041')).toBe('2026041');
    expect(vyctiVariabilniSymbol('faktura 2026041 ze dne 150926')).toBeNull();
  });

  it('z prázdného textu nic', () => {
    expect(vyctiVariabilniSymbol('')).toBeNull();
    expect(vyctiVariabilniSymbol(null)).toBeNull();
    expect(vyctiVariabilniSymbol('platba za nahrávání')).toBeNull();
  });
});

describe('najdiFakturuKPlatbe', () => {
  const faktury = [faktura('a', '2026041', 121000), faktura('b', '2026042', 60500)];

  it('sedí VS i částka - označí samo', () => {
    const nalez = najdiFakturuKPlatbe({ amountMinor: 121000, currency: 'CZK', variableSymbol: '2026041' }, faktury);
    expect(nalez).toMatchObject({ druh: 'presna', invoiceId: 'a' });
  });

  it('VS jen v textu platby taky stačí', () => {
    const nalez = najdiFakturuKPlatbe(
      { amountMinor: 60500, currency: 'CZK', variableSymbol: null, reference: 'VS: 2026042' },
      faktury,
    );
    expect(nalez).toMatchObject({ druh: 'presna', invoiceId: 'b' });
  });

  it('sedí VS, nesedí částka - jen návrh', () => {
    const nalez = najdiFakturuKPlatbe({ amountMinor: 100000, currency: 'CZK', variableSymbol: '2026041' }, faktury);
    expect(nalez).toMatchObject({ druh: 'navrh', invoiceId: 'a' });
  });

  it('bez VS, ale částka sedí jediné faktuře - návrh', () => {
    const nalez = najdiFakturuKPlatbe({ amountMinor: 121000, currency: 'CZK', reference: 'platba' }, faktury);
    expect(nalez).toMatchObject({ druh: 'navrh', invoiceId: 'a' });
  });

  it('stejná částka u dvou faktur se nenabízí', () => {
    const dve = [faktura('a', '2026041', 121000), faktura('c', '2026043', 121000)];
    expect(najdiFakturuKPlatbe({ amountMinor: 121000, currency: 'CZK' }, dve).druh).toBe('nic');
  });

  it('jiná měna se nepáruje', () => {
    const nalez = najdiFakturuKPlatbe({ amountMinor: 121000, currency: 'EUR', variableSymbol: '2026041' }, faktury);
    expect(nalez.druh).toBe('nic');
  });

  it('odchozí platba a prázdný seznam', () => {
    expect(najdiFakturuKPlatbe({ amountMinor: -5000, currency: 'CZK', variableSymbol: '2026041' }, faktury).druh).toBe('nic');
    expect(najdiFakturuKPlatbe({ amountMinor: 5000, currency: 'CZK' }, []).druh).toBe('nic');
  });
});
