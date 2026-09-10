import QRCode from 'qrcode';

/**
 * QR kody na instalacni stranku (zadani 10. 9. 2026: "nemuzu dat lidem jen
 * nejaky QR kod?").
 *
 * Kod se kresli az na serveru, do prohlizece jde hotovy obrazek. Diky tomu
 * nemusi nic dopocitavat mobil, ktery stranku otevre, a QR se da stejnym
 * volanim vydat i jako PNG do e-mailu nebo na plakat.
 *
 * BARVY: tmava je firemni fialova, podklad vzdy bila - i v tmavem rezimu.
 * Ctecky v telefonech pocitaji s tim, ze kod je tmavy na svetlem, a
 * prevraceny kontrast jim casto dela potize.
 */

/** Fialova z loga; svetlejsi odstiny uz ctecky citaji hure. */
const TMAVA = '#4B1FA8';
const SVETLA = '#FFFFFF';

/**
 * Korekce chyb "M" - kod snese poskozeni asi patnacti procent plochy.
 * U vytisknuteho letaku nebo fotky na monitoru se to hodi a adresa je
 * kratka, takze to kod nijak nezvetsi.
 */
const NASTAVENI = { errorCorrectionLevel: 'M' as const, margin: 1, color: { dark: TMAVA, light: SVETLA } };

/**
 * QR jako SVG - vklada se rovnou do stranky a skaluje se bez rozmazani.
 *
 * Sirka se schvalne nenastavuje: obrazek si ji vezme od ramecku, do ktereho
 * ho stranka vlozi (viz [&>svg]:w-full na instalacni strance).
 */
export async function qrSvg(text: string): Promise<string> {
  return QRCode.toString(text, { ...NASTAVENI, type: 'svg' });
}

/** QR jako PNG - na stazeni, aby slo poslat mailem nebo dat do prezentace. */
export async function qrPng(text: string, sirka = 1024): Promise<Buffer> {
  return QRCode.toBuffer(text, { ...NASTAVENI, type: 'png', width: sirka });
}
