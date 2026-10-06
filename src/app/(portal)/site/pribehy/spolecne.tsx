'use client';

import { POVOLENE_TYPY } from '@/lib/pribehy';

/**
 * Drobnosti, které sdílí editor i přehled příběhů. Zvlášť proto, aby se
 * nemusely dovážet přes půl obrazovky a nevznikly dvě podoby téhož.
 */

/** Firemní kroužek kolem příběhu - stejný nápad jako nepřečtená story. */
export const KROUZEK = 'bg-gradient-to-tr from-brand-green via-brand-purple to-brand-purpleDeep';
export const KROUZEK_KLID = 'bg-line';

/** Prohlížeč u .mov občas typ nepozná - doplníme ho z přípony. */
export function typSouboru(soubor: File): string {
  if (soubor.type && POVOLENE_TYPY.includes(soubor.type)) return soubor.type;
  const pripona = soubor.name.toLowerCase().split('.').pop() ?? '';
  if (pripona === 'mov') return 'video/quicktime';
  if (pripona === 'mp4' || pripona === 'm4v') return 'video/mp4';
  if (pripona === 'jpg' || pripona === 'jpeg') return 'image/jpeg';
  if (pripona === 'png') return 'image/png';
  if (pripona === 'webp') return 'image/webp';
  return soubor.type;
}

/** Kolečko s iniciálami účtu - zastupuje profilovku, aby se nic nestahovalo. */
export function Znacka({ velikost = 36 }: { velikost?: number }) {
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-full p-[2px] ${KROUZEK}`}
      style={{ width: velikost, height: velikost }}
    >
      <span
        className="grid h-full w-full place-items-center rounded-full bg-bar font-heading font-semibold text-white"
        style={{ fontSize: velikost * 0.36 }}
      >
        MS
      </span>
    </span>
  );
}
