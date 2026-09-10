import type { DruhArchivu } from '@prisma/client';

/**
 * Archivace před smazáním (zadání 10. 9. 2026: „pak se ještě můžu rozhodnout,
 * zda o ně přijdu, nebo ty věci konkrétní archivuju a smažu uživatele, firmu
 * atd.").
 *
 * Tenhle soubor je bez Prismy (jen typ), aby si popisky mohl vzít i formulář
 * v prohlížeči.
 */

export const POPISKY_DRUHU_ARCHIVU: Record<DruhArchivu, string> = {
  FIRMA: 'Firma',
  UZIVATEL: 'Uživatel',
  PROJEKT: 'Projekt',
};

/** Jak se má naložit s tím, co na záznamu visí. */
export type ZpusobSmazani = 'archivovat' | 'smazat-vse';

export const POPISKY_ZPUSOBU: Record<ZpusobSmazani, string> = {
  'archivovat': 'Archivovat a smazat',
  'smazat-vse': 'Smazat i s navázanými věcmi',
};

export function jeZpusobSmazani(hodnota: string): hodnota is ZpusobSmazani {
  return hodnota === 'archivovat' || hodnota === 'smazat-vse';
}
