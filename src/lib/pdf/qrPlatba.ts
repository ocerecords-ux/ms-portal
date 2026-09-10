import QRCode from 'qrcode';

/**
 * QR platba na fakturách (zadání 10. 9. 2026: „ještě bych potřeboval na
 * faktury QR kód").
 *
 * Používá se český standard QR Platba (formát SPD 1.0, Česká bankovní
 * asociace) - stejný, jaký čtou bankovní aplikace v mobilu. Řetězec je čitelný
 * text, žádné kódování navíc:
 *
 *   SPD*1.0*ACC:CZ6508000000192000145399*AM:12100.00*CC:CZK*X-VS:2026001*...
 *
 * Kód se do dokumentu KRESLÍ jako čtverečky, nevkládá se jako obrázek. Díky
 * tomu je ostrý při jakémkoliv zvětšení, PDF nenese žádnou bitmapu a nemusíme
 * do dokumentu tahat dekodér obrázků.
 */

/** Co banka potřebuje vědět, aby platbu předvyplnila. */
export type PrikazKPlatbe = {
  iban: string;
  /** Částka v halérích/centech; záporná ani nulová se do kódu nedává. */
  castkaMinor: number;
  mena: string;
  variabilniSymbol?: string | null;
  /** Zpráva pro příjemce - standard ji omezuje na 60 znaků. */
  zprava?: string | null;
  splatnost?: Date | null;
  swift?: string | null;
};

/** Písmena v IBANu se pro kontrolní součet přepisují na čísla: A=10 … Z=35. */
function pismenaNaCisla(text: string): string {
  return text.replace(/[A-Z]/g, (ch) => String(ch.charCodeAt(0) - 55));
}

/** Zbytek po dělení 97 pro číslo delší, než unese number. */
function mod97(cislice: string): number {
  let zbytek = 0;
  for (const znak of cislice) zbytek = (zbytek * 10 + Number(znak)) % 97;
  return zbytek;
}

/**
 * Sestaví český IBAN z tuzemského tvaru účtu ("19-2000145399/0800").
 * Vrací null, když tvar nesedí - radši žádný QR než QR se špatným účtem.
 */
export function ibanZTuzemskehoUctu(ucet: string): string | null {
  const ocisteny = ucet.replace(/\s/g, '');
  const shoda = ocisteny.match(/^(?:(\d{1,6})-)?(\d{1,10})\/(\d{4})$/);
  if (!shoda) return null;

  const predcisli = (shoda[1] ?? '').padStart(6, '0');
  const cislo = shoda[2].padStart(10, '0');
  const banka = shoda[3];

  const zaklad = `${banka}${predcisli}${cislo}`;
  const kontrola = 98 - mod97(pismenaNaCisla(`${zaklad}CZ00`));
  return `CZ${String(kontrola).padStart(2, '0')}${zaklad}`;
}

/** Ověří kontrolní číslice IBANu - chybný účet nemá v QR co dělat. */
export function jeIbanPlatny(iban: string): boolean {
  const ocisteny = iban.replace(/\s/g, '').toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(ocisteny)) return false;
  const prehozeny = ocisteny.slice(4) + ocisteny.slice(0, 4);
  return mod97(pismenaNaCisla(prehozeny)) === 1;
}

/** Do řetězce SPD nesmí hvězdička (odděluje pole) ani zalomení řádku. */
function ocistiHodnotu(text: string, delka: number): string {
  return text
    .replace(/[*\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, delka);
}

/**
 * Řetězec QR platby. Vrací null, když chybí něco, bez čeho by kód byl
 * k ničemu (účet, částka) - volající pak QR prostě nevykreslí.
 */
export function spdRetezec(prikaz: PrikazKPlatbe): string | null {
  const iban = prikaz.iban.replace(/\s/g, '').toUpperCase();
  if (!jeIbanPlatny(iban) || prikaz.castkaMinor <= 0) return null;

  const casti = [`ACC:${iban}${prikaz.swift ? `+${prikaz.swift.replace(/\s/g, '').toUpperCase()}` : ''}`];
  casti.push(`AM:${(prikaz.castkaMinor / 100).toFixed(2)}`);
  casti.push(`CC:${prikaz.mena.toUpperCase()}`);
  if (prikaz.variabilniSymbol) {
    const vs = prikaz.variabilniSymbol.replace(/\D/g, '').slice(0, 10);
    if (vs) casti.push(`X-VS:${vs}`);
  }
  if (prikaz.splatnost) {
    const d = prikaz.splatnost;
    const den = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    casti.push(`DT:${den}`);
  }
  if (prikaz.zprava) {
    const zprava = ocistiHodnotu(prikaz.zprava, 60);
    if (zprava) casti.push(`MSG:${zprava}`);
  }

  return `SPD*1.0*${casti.join('*')}`;
}

/** Čtverečky kódu jako mřížka true/false - kreslí se z nich přímo do PDF. */
export function qrModuly(text: string): { velikost: number; body: boolean[] } {
  // Korekce "M" snese poskozeni asi 15 % plochy; u vytisknute faktury,
  // kterou nekdo skenuje nebo fotí z monitoru, se to hodí.
  const kod = QRCode.create(text, { errorCorrectionLevel: 'M' });
  const velikost = kod.modules.size;
  const data = kod.modules.data;
  const body: boolean[] = [];
  for (let i = 0; i < velikost * velikost; i += 1) body.push(Boolean(data[i]));
  return { velikost, body };
}
