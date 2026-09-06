import type { WorkType } from '@prisma/client';

/**
 * Vykazy zvukaru (zadani 6. 9. 2026). Cas drzime jako minuty od pulnoci -
 * z formulare chodi "HH:MM", v databazi je to cislo, at se s tim da pocitat
 * bez casovych pasem.
 */

export const WORK_TYPE_LABELS: Record<WorkType, string> = {
  RECORDING: 'Natáčení',
  EDITING: 'Střih',
};

export const WORK_TYPE_OPTIONS: WorkType[] = ['RECORDING', 'EDITING'];

/** Vychozi hodinova sazba zvukare, kdyz ji nema u uctu vyplnenou. */
export const DEFAULT_HOURLY_RATE = 250;

/** "08:30" -> 510. Vraci null, kdyz to neni platny cas. */
export function parseTime(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/** 510 -> "08:30" */
export function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Delka prace v minutach. Kdyz je konec driv nez zacatek, bere se to jako
 * prace pres pulnoc (napr. 22:00-01:30).
 */
export function durationMinutes(startMinutes: number, endMinutes: number): number {
  const diff = endMinutes - startMinutes;
  return diff > 0 ? diff : diff + 24 * 60;
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

/** Hodiny jako desetinne cislo - pro vypocet castky. */
export function toHours(minutes: number): number {
  return minutes / 60;
}

/** Castka za vykaz v Kc, zaokrouhlena na cele koruny. */
export function entryAmount(startMinutes: number, endMinutes: number, hourlyRate: number): number {
  return Math.round(toHours(durationMinutes(startMinutes, endMinutes)) * hourlyRate);
}

export function formatCzk(value: number): string {
  return `${value.toLocaleString('cs-CZ')} Kč`;
}
