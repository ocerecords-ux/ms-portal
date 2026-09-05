import type { ProjectPriority } from '@prisma/client';

/**
 * Ciselniky pro interni atributy projektu (viz model ProjectMeta v
 * schema.prisma) - zadani 5. 9. 2026.
 */

export const PRIORITY_OPTIONS: ProjectPriority[] = ['LOW', 'MEDIUM', 'HIGH'];

export const PRIORITY_LABELS: Record<ProjectPriority, string> = {
  LOW: 'Nízká',
  MEDIUM: 'Střední',
  HIGH: 'Vysoká',
};

/** Barvy stitku priority v prehledu i na detailu projektu. */
export const PRIORITY_CLASSES: Record<ProjectPriority, string> = {
  LOW: 'bg-[#EEF2F7] text-[#5B6472]',
  MEDIUM: 'bg-[#FDF1DE] text-status-progress',
  HIGH: 'bg-[#FDE4E4] text-[#C22B2B]',
};

/**
 * Typy projektu. Zadani 5. 9. 2026: "Postupně pak typy projektů doplníme" -
 * dalsi typ se prida uz jen jednim radkem sem (klic se uklada do databaze,
 * takze klice existujicich typu uz nemen, jen pripadne label).
 */
export const PROJECT_TYPES: { key: string; label: string }[] = [
  { key: 'AUDIOBOOK', label: 'Natáčení a postprodukce audioknihy' },
  { key: 'RADIO_SPOT', label: 'Výroba rádiového spotu' },
  { key: 'VOICEOVER', label: 'Natáčení voiceoveru' },
];

export const PROJECT_TYPE_KEYS: string[] = PROJECT_TYPES.map((t) => t.key);

export function projectTypeLabel(key: string | null | undefined): string | null {
  if (!key) return null;
  return PROJECT_TYPES.find((t) => t.key === key)?.label ?? key;
}

/**
 * Stavy projektu v Caflou, ktere povazujeme za ROZPRACOVANY projekt
 * (overeno na zivo 5. 9. 2026 - v uctu se vyskytuji tyto stavy: "V přípravě",
 * "Natáčíme", "Dokončeno - ke schválení", "Schváleno - k fakturaci").
 *
 * Priznak `finished` z Caflou na tohle bohuzel pouzit nejde - v uctu ho maji
 * nastaveny uplne vsechny projekty, i ty se stavem "Natáčíme". Rozpracovanost
 * se proto ridi stavem; dalsi stav pridej jednim radkem sem.
 */
export const ACTIVE_PROJECT_STATUSES: string[] = ['V přípravě', 'Natáčíme'];

export function isActiveProjectStatus(statusName: string | null | undefined): boolean {
  if (!statusName) return false;
  const normalized = statusName.trim().toLowerCase();
  return ACTIVE_PROJECT_STATUSES.some((s) => s.toLowerCase() === normalized);
}
