import type { WorkType } from '@prisma/client';
import { kodJazyka, prelozit, type Jazyk } from '@/lib/jazyk';

/**
 * Vykazy zvukaru (zadani 6. 9. 2026). Cas drzime jako minuty od pulnoci -
 * z formulare chodi "HH:MM", v databazi je to cislo, at se s tim da pocitat
 * bez casovych pasem.
 */

export const WORK_TYPE_LABELS: Record<WorkType, string> = {
  RECORDING: 'Natáčení',
  EDITING: 'Střih',
  REPAIRS: 'Opravy',
  OTHER: 'Ostatní',
};

/**
 * Nazev druhu prace podle KODU, ne podle ceskeho popisku (vzor nazevMeny
 * z davky 4). Jazyk je NEPOVINNY - bez nej vraci cestinu, aby PDF a posta
 * mluvily dal cesky. WORK_TYPE_LABELS zustava: bere si ho vypocet a vykazy
 * ukladane do databaze.
 */
export function nazevDruhuPrace(druh: WorkType, jazyk?: Jazyk): string {
  if (!jazyk) return WORK_TYPE_LABELS[druh];
  return prelozit(jazyk, `druhPrace.${druh}`);
}

/**
 * Poradi ve formulari i ve filtrech. Opravy stoji za strihem, protoze v case
 * prichazeji az po nem; "Ostatni" zustava posledni - je to zbytkova kategorie.
 */
export const WORK_TYPE_OPTIONS: WorkType[] = ['RECORDING', 'EDITING', 'REPAIRS', 'OTHER'];

/**
 * Vybira se u tohohle druhu prace projekt? U "Ostatni" ne (zadani 8. 9. 2026:
 * "kdyz tam bude Ostatni, tak zmizi vyber prirazeni k projektu") - je to
 * prace, ktera ke konkretni zakazce nepatri.
 *
 * OPRAVY projekt naopak MAJI MIT (zadani 30. 9. 2026: "Pujde to navazat na
 * projekt. A bude se to pocitat do rozpoctu"). Bez projektu by nebylo do ceho
 * je pocitat - cerpani rozpoctu jde vzdycky pres caflouProjectId.
 */
export function requiresProject(workType: WorkType | ''): boolean {
  return workType !== 'OTHER';
}

/**
 * Druhy prace, ktere cerpaji rozpocet projektu. Nataceni a strih maji
 * v rozpoctu vlastni radek spocitany z normostran; OPRAVY zadny nemaji -
 * cerpaji tentyz rozpocet na vyrobu, takze se na nich pozna, ze kniha
 * pretekla kvuli pretacenim (zadani 30. 9. 2026). "Ostatni" k projektu
 * nepatri vubec.
 */
export const DRUHY_DO_ROZPOCTU: WorkType[] = ['RECORDING', 'EDITING', 'REPAIRS'];

/** Ma tenhle druh prace v rozpoctu svuj vlastni strop? */
export function maVlastniRozpocet(workType: WorkType): boolean {
  return workType === 'RECORDING' || workType === 'EDITING';
}

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

/**
 * Částka v korunách. Jazyk je NEPOVINNÝ (dávka 7, 28. 9. 2026) - volající,
 * kteří ho neřeší (pošta, oznámení pod zvonkem), dál dostanou češtinu beze
 * změny. V angličtině se mění jen oddělovač tisíců: „1,234 Kč".
 */
export function formatCzk(value: number, jazyk: Jazyk = 'cs'): string {
  return `${value.toLocaleString(kodJazyka(jazyk))} Kč`;
}
