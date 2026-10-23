import type { Currency } from '@prisma/client';

/**
 * POKLADNA - společné počty a popisky (zadání 23. 10. 2026: „potřebuju někde
 * udělat pokladnu").
 *
 * Soubor je ČISTÝ (bez databáze), aby ho mohla použít i obrazovka
 * v prohlížeči - stejné pravidlo jako u lib/doklady.ts.
 *
 * Částky se drží v NEJMENŠÍ JEDNOTCE měny jako celé číslo, a to vždy KLADNĚ;
 * jestli jde o příjem, nebo výdej, říká `smer`. Záporné částky by se
 * v pokladní knize četly špatně a při sčítání by se v nich snadno ztratilo
 * znaménko.
 */

export const SMERY = { prijem: 'PRIJEM', vydej: 'VYDEJ' } as const;
export type Smer = (typeof SMERY)[keyof typeof SMERY];

/** Sazby DPH na pokladním dokladu; 0 = bez DPH (účtenka od neplátce). */
export const SAZBY_DPH = [21, 12, 0];

export type PohybPokladny = {
  smer: Smer;
  castkaMinor: number;
};

/** Kladně příjem, záporně výdej - jen pro sčítání, nikam se to neukládá. */
export function znamenko(pohyb: PohybPokladny): number {
  return pohyb.smer === SMERY.prijem ? pohyb.castkaMinor : -pohyb.castkaMinor;
}

export type SoucetPokladny = {
  prijmyMinor: number;
  vydajeMinor: number;
  zmenaMinor: number;
};

export function secti(pohyby: PohybPokladny[]): SoucetPokladny {
  let prijmyMinor = 0;
  let vydajeMinor = 0;
  for (const p of pohyby) {
    if (p.smer === SMERY.prijem) prijmyMinor += p.castkaMinor;
    else vydajeMinor += p.castkaMinor;
  }
  return { prijmyMinor, vydajeMinor, zmenaMinor: prijmyMinor - vydajeMinor };
}

/**
 * Zůstatek po každém dokladu. Doklady musí přijít seřazené od nejstaršího -
 * běžný zůstatek se jinak nedá napsat.
 */
export function zustatkyPoRadcich<T extends PohybPokladny>(
  pocatek: number,
  pohyby: T[],
): (T & { zustatekMinor: number })[] {
  let zustatek = pocatek;
  return pohyby.map((p) => {
    zustatek += znamenko(p);
    return { ...p, zustatekMinor: zustatek };
  });
}

/**
 * Základ a DPH z částky, která je VČETNĚ daně. Na pokladním dokladu se píše
 * to, co člověk doopravdy zaplatil, takže daň se počítá shora dolů.
 */
export function rozpisDph(castkaMinor: number, vatRate: number): { zaklad: number; dph: number } {
  if (!vatRate) return { zaklad: castkaMinor, dph: 0 };
  const zaklad = Math.round((castkaMinor * 100) / (100 + vatRate));
  return { zaklad, dph: castkaMinor - zaklad };
}

/**
 * Výchozí název pokladny, když si ho nikdo nepřepsal. Jméno firmy se do něj
 * nepíše - to je nad seznamem a dvakrát na jedné obrazovce by jen překáželo.
 */
export const VYCHOZI_NAZEV = 'Hlavní pokladna';

/** Smí se tenhle doklad upravit nebo smazat přímo v pokladně? */
export function jdeUpravit(doklad: { expenseId?: string | null }): boolean {
  return !doklad.expenseId;
}

/**
 * Výchozí měna pokladny. Bere se z naší firmy - za kterou firmu se fakturuje,
 * v té měně se u ní drží i hotovost.
 */
export function vychoziMena(firma: { defaultCurrency?: Currency | null } | null): Currency {
  return firma?.defaultCurrency ?? 'CZK';
}
