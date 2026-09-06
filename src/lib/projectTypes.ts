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
 * Typ projektu uz NENI pevny seznam v kodu - od 5. 9. 2026 se bere z Ceniku
 * (model PriceListItem, viz lib/priceList.ts): "to, co máme v seznamu ceníku,
 * bude sloužit i jako typ projektu". V ProjectMeta.projectType je ulozeny
 * primo nazev polozky, takze zustane citelny i po vyrazeni z ceniku.
 */
export function projectTypeLabel(key: string | null | undefined): string | null {
  const value = key?.trim();
  return value ? value : null;
}

export const ACTIVE_PROJECT_STATUSES: string[] = ['V přípravě', 'Natáčíme'];

export function isActiveProjectStatus(statusName: string | null | undefined): boolean {
  if (!statusName) return false;
  const normalized = statusName.trim().toLowerCase();
  return ACTIVE_PROJECT_STATUSES.some((s) => s.toLowerCase() === normalized);
}
