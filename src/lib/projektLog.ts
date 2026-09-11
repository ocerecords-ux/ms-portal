import type { DruhUdalosti } from '@prisma/client';
import { PRIORITY_LABELS } from '@/lib/projectTypes';

/**
 * Historie projektu (zadání 10. 9. 2026: „něco jako LOG u každého projektu —
 * takovou historii, co se v projektu upravilo a kdy šla nějaká notifikace").
 *
 * Tenhle soubor je bez Prismy (jen typ), aby si popisky mohl vzít i komponent
 * v prohlížeči.
 *
 * ZÁZNAM SE UKLÁDÁ UŽ ČITELNÝ. Do sloupců `predchozi` a `nova` jde jméno
 * manažera, ne jeho ID — historie má dávat smysl i za rok, kdy ten účet už
 * třeba nebude existovat.
 */

/** Jak se pole jmenuje v historii. Co tu není, se nezapisuje. */
export const POPISKY_POLI: Record<string, string> = {
  name: 'Název',
  statusName: 'Stav',
  priority: 'Priorita',
  projectType: 'Typ projektu',
  driveUrl: 'Odkaz na KZ',
  managerUserId: 'Manažer projektu',
  actorUserId: 'Herci',
  klientUserId: 'Klient',
  companyId: 'Firma',
  narrator: 'Herec (text)',
  endDate: 'Datum dokončení',
  releaseDate: 'Datum vydání',
  pageCount: 'Normostrany',
  finished: 'Dokončeno',
  spotName: 'Název spotu',
  rlClientName: 'Klient na RL',
  spotLengthSeconds: 'Délka spotu',
  directorName: 'Režie',
  musicTitle: 'Hudba - název',
  musicAuthor: 'Hudba - autor',
  noMusic: 'Spot bez hudby',
  productionDate: 'Datum výroby',
};

/** Pole, u kterých se do historie ukládá jméno navázaného účtu, ne jeho ID. */
export const POLE_S_UCTEM = new Set(['managerUserId', 'actorUserId', 'klientUserId', 'companyId']);

export const POPISKY_DRUHU: Record<DruhUdalosti, string> = {
  ZALOZENO: 'Založení',
  ZMENA: 'Změna',
  NOTIFIKACE: 'Zpráva',
  BRUNO: 'Bruno',
};

/** Barva odznaku podle druhu události — ať jde historie číst na první pohled. */
export const BARVY_DRUHU: Record<DruhUdalosti, string> = {
  ZALOZENO: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200',
  ZMENA: 'bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-200',
  NOTIFIKACE: 'bg-violet-100 text-violet-800 dark:bg-violet-500/15 dark:text-violet-200',
  // Bruno ma vlastni barvu, at je v historii hned videt, co vycetl asistent
  // z chatu a co tam zapsal clovek (zadani 12. 9. 2026).
  BRUNO: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200',
};

/** Prázdná hodnota se ukazuje pomlčkou, ne prázdným místem. */
export const PRAZDNO = '—';

/**
 * Hodnota, jak se zapíše do historie. Datum jako datum (bez času - u projektu
 * jsou to termíny, ne okamžiky), Ano/Ne místo true/false, priorita popiskem.
 */
export function citelnaHodnota(pole: string, hodnota: unknown): string {
  if (hodnota === null || hodnota === undefined || hodnota === '') return PRAZDNO;
  if (hodnota instanceof Date) return new Intl.DateTimeFormat('cs-CZ').format(hodnota);
  if (typeof hodnota === 'boolean') return hodnota ? 'Ano' : 'Ne';
  if (pole === 'priority') {
    const klic = String(hodnota) as keyof typeof PRIORITY_LABELS;
    return PRIORITY_LABELS[klic] ?? String(hodnota);
  }
  if (pole === 'spotLengthSeconds') return `${hodnota} s`;
  return String(hodnota);
}

/** Datum a čas události - u historie má smysl i čas, na rozdíl od termínů. */
export function formatujCas(kdy: Date): string {
  return new Intl.DateTimeFormat('cs-CZ', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(kdy);
}
