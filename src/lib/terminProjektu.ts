/**
 * BLÍŽÍCÍ SE TERMÍN DOKONČENÍ (zadání 18. 9. 2026).
 *
 * Datum dokončení v přehledu projektů bylo do teď šedivé číslo jako každé
 * jiné. Zadání: „když bude datum dokončení za tři dny, změní se barva na
 * zelenou a zvětší se i velikost toho data (objeví se odznak s číslem, kolik
 * zbývá do termínu dní)" - a dál oranžová v den termínu a červená s odpočtem
 * do mínusu po termínu.
 *
 * DATUM VYDÁNÍ SE NEBARVÍ („datum vydání teď nechme stranou").
 *
 * Soubor je bez Prismy - počítá se z něj v prohlížeči (přehled projektů)
 * i na serveru (denní úloha, která posílá upozornění pod zvonek).
 */

/** Kolik dní před termínem cinkne zvonek u dlouhodobých projektů. */
export const DNU_PRED_TERMINEM = 7;

/** Odkdy se datum v přehledu barví a zvětšuje. */
export const DNU_NA_ZVYRAZNENI = 3;

export type StavTerminu =
  /** Termín je daleko - datum vypadá jako každé jiné. */
  | 'daleko'
  /** Do tří dnů včetně. */
  | 'blizko'
  /** Termín je dnes. */
  | 'dnes'
  /** Po termínu - odpočet jde do mínusu. */
  | 'po';

/** Den jako YYYY-MM-DD; u `Date` se bere podle místního času, ne UTC. */
function den(hodnota: Date | string): string {
  if (typeof hodnota === 'string') return hodnota.slice(0, 10);
  const posun = hodnota.getTimezoneOffset() * 60 * 1000;
  return new Date(hodnota.getTime() - posun).toISOString().slice(0, 10);
}

/**
 * Kolik dní zbývá do termínu. Dnes = 0, včera = −1.
 *
 * Počítají se KALENDÁŘNÍ DNY, ne čas: „za tři dny" znamená třetí datum
 * v kalendáři, ať je zrovna ráno nebo večer. Kdyby se počítaly hodiny,
 * termín by se rozsvěcel a zhasínal podle toho, kdy se člověk dívá.
 */
export function dnuDoTerminu(
  termin: Date | string | null | undefined,
  dnes: Date | string = new Date(),
): number | null {
  if (!termin) return null;
  const doCisla = (d: string) => {
    const [r, m, dd] = d.split('-').map(Number);
    if (!r || !m || !dd) return null;
    return Date.UTC(r, m - 1, dd);
  };
  const cil = doCisla(den(termin));
  const ted = doCisla(den(dnes));
  if (cil === null || ted === null) return null;
  return Math.round((cil - ted) / (24 * 60 * 60 * 1000));
}

export function stavTerminu(dnu: number | null): StavTerminu {
  if (dnu === null) return 'daleko';
  if (dnu < 0) return 'po';
  if (dnu === 0) return 'dnes';
  return dnu <= DNU_NA_ZVYRAZNENI ? 'blizko' : 'daleko';
}

/** „1 den" / „2 dny" / „5 dní" - česky, ať odznak nezní jako z automatu. */
export function dnuSlovy(pocet: number): string {
  const n = Math.abs(pocet);
  if (n === 1) return `${n} den`;
  if (n >= 2 && n <= 4) return `${n} dny`;
  return `${n} dní`;
}

/**
 * Co stojí u data - HOLÉ ČÍSLO (upřesnění 18. 9. 2026: „aby se u data objevila
 * jen čísla +1 nebo −2, nepsal bych tam dny, to je jasné, čeho se to týká").
 *
 * V přehledu se sází jako horní index vedle data, takže každé písmeno navíc
 * roztahuje sloupec. Znaménko zůstává: „+2" a „−2" jsou na první pohled dvě
 * různé zprávy, samotná dvojka by byla hádanka.
 */
export function odznakTerminu(dnu: number | null): string | null {
  const stav = stavTerminu(dnu);
  if (dnu === null || stav === 'daleko') return null;
  if (stav === 'dnes') return '0';
  // Typograficke minus, ne spojovnik - u cisla je citelnejsi.
  return stav === 'po' ? `−${Math.abs(dnu)}` : `+${dnu}`;
}
