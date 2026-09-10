import type { PaymentMethod } from '@prisma/client';

/**
 * Sdílené věci k dokladům vyfoceným fotoaparátem (zadání 10. 9. 2026:
 * "budu chtít v portálu scan přes foťák, abych naskenoval doklad").
 *
 * Tenhle soubor je bez Prismy, aby si ho mohl vzít i formulář v prohlížeči.
 * Samotné čtení fotky sedí v uctenkaServer.ts.
 */

/** Názvy způsobů úhrady pro formuláře a výpisy. */
export const ZPUSOBY_UHRADY: { hodnota: PaymentMethod; nazev: string }[] = [
  { hodnota: 'CARD', nazev: 'Kartou' },
  { hodnota: 'CASH', nazev: 'Hotově' },
  { hodnota: 'TRANSFER', nazev: 'Převodem' },
];

export function nazevZpusobuUhrady(zpusob: PaymentMethod): string {
  return ZPUSOBY_UHRADY.find((z) => z.hodnota === zpusob)?.nazev ?? 'Převodem';
}

/**
 * Je doklad zaplacený už tím, že vznikl?
 *
 * Účtenka z terminálu nebo za hotové je zaplacená na místě. Faktura placená
 * převodem ne - u té se čeká na platbu, i když přijde do minuty.
 */
export function zaplacenoRovnou(zpusob: PaymentMethod): boolean {
  return zpusob === 'CARD' || zpusob === 'CASH';
}

/** Co se z účtenky podařilo přečíst. Cokoliv může chybět - účtenky bývají mizerné. */
export type PrectenaUctenka = {
  /** Dodavatel, jak je natištěný na účtence (název čerpací stanice, obchodu). */
  dodavatel: string | null;
  /** Krátký popis, co se kupovalo - jde do pole Název. */
  popis: string | null;
  /** Datum ve tvaru YYYY-MM-DD. */
  datum: string | null;
  /** Celková částka VČETNĚ DPH, v korunách jako text ("1234,50"). */
  castkaSDph: string | null;
  /** Částka BEZ DPH, pokud je na účtence uvedená zvlášť. */
  castkaBezDph: string | null;
  /** Sazba DPH v procentech (21, 12, 0). */
  sazbaDph: number | null;
  /** Měna podle značky na účtence. */
  mena: string | null;
  /** Číslo dokladu, pokud na účtence je. */
  cislo: string | null;
  zpusobUhrady: PaymentMethod | null;
  /**
   * Jak si je čtení jisté (0-1). Pod hranicí se ve formuláři napíše, ať to
   * člověk radši překontroluje - u zmuchlané účtenky z benzinky to je časté.
   */
  jistota: number | null;
};

export const MAX_FOTKA_BYTES = 12 * 1024 * 1024;

/** Prázdný výsledek - použije se, když se nepodařilo přečíst vůbec nic. */
export const PRAZDNA_UCTENKA: PrectenaUctenka = {
  dodavatel: null,
  popis: null,
  datum: null,
  castkaSDph: null,
  castkaBezDph: null,
  sazbaDph: null,
  mena: null,
  cislo: null,
  zpusobUhrady: null,
  jistota: null,
};
